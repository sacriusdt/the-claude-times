import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type Provider = 'anthropic' | 'openai' | 'openrouter';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CompletionOptions {
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  stream?: false;
}

interface StreamOptions {
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  stream: true;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  openrouter: 'anthropic/claude-sonnet-4-20250514',
};

function getProvider(): Provider {
  return (process.env.AI_PROVIDER as Provider) || 'anthropic';
}

function getModel(): string {
  return process.env.AI_MODEL || DEFAULT_MODELS[getProvider()];
}

// --- Anthropic ---

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function anthropicComplete(opts: CompletionOptions): Promise<string> {
  const client = getAnthropicClient();
  const system = opts.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const messages = opts.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const response = await client.messages.create({
    model: getModel(),
    max_tokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.7,
    system: system || undefined,
    messages,
  });

  return response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}

async function* anthropicStream(opts: StreamOptions): AsyncGenerator<string> {
  const client = getAnthropicClient();
  const system = opts.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const messages = opts.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const stream = client.messages.stream({
    model: getModel(),
    max_tokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.7,
    system: system || undefined,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

// --- OpenAI / OpenRouter ---

function getOpenAIClient() {
  const provider = getProvider();
  if (provider === 'openrouter') {
    return new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function openaiComplete(opts: CompletionOptions): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: getModel(),
    max_tokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.7,
    messages: opts.messages.map(m => ({ role: m.role, content: m.content })),
  });
  return response.choices[0]?.message?.content || '';
}

async function* openaiStream(opts: StreamOptions): AsyncGenerator<string> {
  const client = getOpenAIClient();
  const stream = await client.chat.completions.create({
    model: getModel(),
    max_tokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.7,
    messages: opts.messages.map(m => ({ role: m.role, content: m.content })),
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// --- Public API ---

export async function complete(opts: CompletionOptions): Promise<string> {
  const provider = getProvider();
  if (provider === 'anthropic') return anthropicComplete(opts);
  return openaiComplete(opts);
}

export async function* streamComplete(opts: StreamOptions): AsyncGenerator<string> {
  const provider = getProvider();
  if (provider === 'anthropic') yield* anthropicStream(opts);
  else yield* openaiStream(opts);
}
