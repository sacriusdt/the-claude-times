import { streamComplete } from '@/lib/providers';
import { writeArticleOnDemand } from '@/lib/agent';
import { insertChatMessage, getChatHistory } from '@/lib/db';
import { JEAN_CLAUDE_SYSTEM, CHAT_SYSTEM } from '@/lib/personality';

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

  // Check if this is an article request
  const isArticleRequest = /write|article|cover|report|piece|story/i.test(message) &&
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
        if (isArticleRequest) {
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
          const topicResponse = await (await import('@/lib/providers')).complete({
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
