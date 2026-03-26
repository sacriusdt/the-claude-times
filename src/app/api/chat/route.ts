import { streamComplete } from '@/lib/providers';
import { writeArticleOnDemand } from '@/lib/agent';
import { insertChatMessage, getChatHistory, getLatestArticles, deleteArticle } from '@/lib/db';
import { JEAN_CLAUDE_SYSTEM, CHAT_SYSTEM } from '@/lib/personality';
import { complete } from '@/lib/providers';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { password, message } = await req.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Auth check
  if (message === '__auth_check__') {
    const history = getChatHistory(30)
      .reverse()
      .map(m => ({ role: m.role, content: m.content }));
    return new Response(JSON.stringify({ ok: true, history }), { status: 200 });
  }

  // Save user message
  insertChatMessage('user', message);

  // Check if this is a delete request (checked first — takes priority)
  const isDeleteRequest = /\b(delete|remove|supprime|supprimer|efface|effacer|retire|retirer|pull|kill)\b/i.test(message);

  // Check if this is an article request (only if not a delete request)
  const isArticleRequest = !isDeleteRequest &&
    /write|article|cover|report|piece|story/i.test(message) &&
    message.length > 10;

  // Build conversation history
  const history = getChatHistory(20).reverse();
  const messages = [
    { role: 'system' as const, content: JEAN_CLAUDE_SYSTEM + '\n\n' + CHAT_SYSTEM },
    ...history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message },
  ];

  // Stream response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (isDeleteRequest) {
          const articles = getLatestArticles(50);

          if (articles.length === 0) {
            const reply = "There's nothing to delete — the archive is empty.";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: reply })}\n\n`));
            insertChatMessage('assistant', reply);
          } else {
            // Ask Jean-Claude to identify which article to delete
            const articleList = articles.map(a => `- slug: "${a.slug}" | title: "${a.title}" | date: ${a.published_at.slice(0, 10)}`).join('\n');
            const identifyResponse = await complete({
              messages: [
                { role: 'system', content: 'You are helping identify which article to delete. Respond ONLY with a JSON object: {"slug": "...", "title": "...", "found": true} if you found a match, or {"found": false} if no match. No explanation.' },
                { role: 'user', content: `Editor request: "${message}"\n\nPublished articles:\n${articleList}` },
              ],
              maxTokens: 100,
              temperature: 0,
            });

            let identified: { slug?: string; title?: string; found: boolean } = { found: false };
            try {
              const jsonMatch = identifyResponse.match(/\{[\s\S]*\}/);
              if (jsonMatch) identified = JSON.parse(jsonMatch[0]);
            } catch { /* ignore */ }

            if (!identified.found || !identified.slug) {
              const reply = "I couldn't identify which article you want to pull. Could you be more specific — give me a title or part of it?";
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: reply })}\n\n`));
              insertChatMessage('assistant', reply);
            } else {
              deleteArticle(identified.slug);

              // Jean-Claude confirms conversationally
              const confirmStream = streamComplete({
                messages: [
                  { role: 'system', content: JEAN_CLAUDE_SYSTEM + '\n\n' + CHAT_SYSTEM },
                  { role: 'user', content: `The editor asked you to delete the article "${identified.title}". It's done — confirm this briefly and naturally (1-2 sentences max).` },
                ],
                maxTokens: 100,
                stream: true,
              });

              let fullReply = '';
              for await (const chunk of confirmStream) {
                fullReply += chunk;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ deleted: { slug: identified.slug, title: identified.title } })}\n\n`));
              insertChatMessage('assistant', fullReply + `\n\n[Article deleted: "${identified.title}"]`);
            }
          }

        } else if (isArticleRequest) {
          // First, chat response about the article
          const chatMessages = [
            ...messages,
            {
              role: 'user' as const,
              content: `The editor wants an article. First, briefly acknowledge what you're going to write about and your angle (2-3 sentences max). Be conversational.`,
            },
          ];

          let fullResponse = '';
          const chatStream = streamComplete({
            messages: chatMessages,
            maxTokens: 300,
            stream: true,
          });

          for await (const chunk of chatStream) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }

          insertChatMessage('assistant', fullResponse);

          // Now write the actual article
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: '\n\n⏳ Researching and writing...' })}\n\n`)
          );

          // Extract the topic from the message
          const topicResponse = await complete({
            messages: [
              {
                role: 'system',
                content: 'Extract the article topic from the user message. Respond with just the topic, nothing else.',
              },
              { role: 'user', content: message },
            ],
            maxTokens: 100,
            temperature: 0,
          });

          const article = await writeArticleOnDemand(topicResponse.trim(), message);

          if (article) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ article })}\n\n`)
            );
            insertChatMessage(
              'assistant',
              `Article published: "${article.title}" → /article/${article.slug}`
            );
          } else {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: '\n\nHmm, I hit a wall writing that piece. Let me try again if you want.' })}\n\n`)
            );
          }
        } else {
          // Regular chat
          let fullResponse = '';
          const chatStream = streamComplete({
            messages,
            maxTokens: 1500,
            stream: true,
          });

          for await (const chunk of chatStream) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }

          insertChatMessage('assistant', fullResponse);
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        console.error('[chat] Error:', err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: `\n\nError: ${(err as Error).message}` })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
