import { streamComplete } from '@/lib/providers';
import { writeArticleOnDemand, sophiaWriteArticleOnDemand } from '@/lib/agent';
import { insertChatMessage, getChatHistory, getLatestArticles, deleteArticle } from '@/lib/db';
import {
  JEAN_CLAUDE_SYSTEM, CHAT_SYSTEM,
  SOPHIA_SYSTEM, SOPHIA_CHAT_SYSTEM,
} from '@/lib/personality';
import { complete } from '@/lib/providers';

export const maxDuration = 300;

function getSophiaModelOpts() {
  return {
    modelOverride: process.env.SOPHIA_MODEL || undefined,
    providerOverride: (process.env.SOPHIA_PROVIDER as 'anthropic' | 'openai' | 'openrouter') || undefined,
  };
}

export async function POST(req: Request) {
  const { password, message, journalist = 'jean-claude' } = await req.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const isSophia = journalist === 'sophia';
  const systemPrompt = isSophia
    ? SOPHIA_SYSTEM + '\n\n' + SOPHIA_CHAT_SYSTEM
    : JEAN_CLAUDE_SYSTEM + '\n\n' + CHAT_SYSTEM;
  const sophiaOpts = isSophia ? getSophiaModelOpts() : {};

  // Auth check
  if (message === '__auth_check__') {
    const history = getChatHistory(30, journalist)
      .reverse()
      .map(m => ({ role: m.role, content: m.content }));
    return new Response(JSON.stringify({ ok: true, history }), { status: 200 });
  }

  insertChatMessage('user', message, journalist);

  const isDeleteRequest = /\b(delete|remove|supprime|supprimer|efface|effacer|retire|retirer|pull|kill)\b/i.test(message);
  const isArticleRequest = !isDeleteRequest &&
    /write|article|cover|report|piece|story|écris|rédige/i.test(message) &&
    message.length > 10;

  const history = getChatHistory(20, journalist).reverse();
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (isDeleteRequest) {
          const articles = getLatestArticles(50);

          if (articles.length === 0) {
            const reply = "There's nothing to delete — the archive is empty.";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: reply })}\n\n`));
            insertChatMessage('assistant', reply, journalist);
          } else {
            const articleList = articles.map(a => `- slug: "${a.slug}" | title: "${a.title}" | author: ${a.author} | date: ${a.published_at.slice(0, 10)}`).join('\n');
            const identifyResponse = await complete({
              ...sophiaOpts,
              messages: [
                { role: 'system', content: 'You are helping identify which article to delete. Respond ONLY with a JSON object: {"slug": "...", "title": "...", "found": true} if found, or {"found": false} if no match. No explanation.' },
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
              const reply = "I couldn't identify which article you want to pull. Could you be more specific?";
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: reply })}\n\n`));
              insertChatMessage('assistant', reply, journalist);
            } else {
              deleteArticle(identified.slug);

              const confirmStream = streamComplete({
                ...sophiaOpts,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: `The editor asked you to delete the article "${identified.title}". It's done — confirm briefly (1-2 sentences max).` },
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
              insertChatMessage('assistant', fullReply + `\n\n[Article deleted: "${identified.title}"]`, journalist);
            }
          }
        } else if (isArticleRequest) {
          const chatMessages = [
            ...messages,
            { role: 'user' as const, content: `The editor wants an article. Briefly acknowledge what you're going to cover and your angle (2-3 sentences). Be yourself.` },
          ];

          let fullResponse = '';
          const chatStream = streamComplete({
            ...sophiaOpts,
            messages: chatMessages,
            maxTokens: 300,
            stream: true,
          });

          for await (const chunk of chatStream) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }
          insertChatMessage('assistant', fullResponse, journalist);

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: '\n\n⏳ Researching and writing...' })}\n\n`));

          const topicResponse = await complete({
            ...sophiaOpts,
            messages: [
              { role: 'system', content: 'Extract the article topic from the user message. Respond with just the topic, nothing else.' },
              { role: 'user', content: message },
            ],
            maxTokens: 100,
            temperature: 0,
          });

          const article = isSophia
            ? await sophiaWriteArticleOnDemand(topicResponse.trim(), message)
            : await writeArticleOnDemand(topicResponse.trim(), message);

          if (article) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ article })}\n\n`));
            insertChatMessage('assistant', `Article published: "${article.title}" → /article/${article.slug}`, journalist);
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: '\n\nHit a wall on that one. Try again?' })}\n\n`));
          }
        } else {
          let fullResponse = '';
          const chatStream = streamComplete({
            ...sophiaOpts,
            messages,
            maxTokens: 1500,
            stream: true,
          });

          for await (const chunk of chatStream) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }
          insertChatMessage('assistant', fullResponse, journalist);
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        console.error('[chat] Error:', err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: `\n\nError: ${(err as Error).message}` })}\n\n`));
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
