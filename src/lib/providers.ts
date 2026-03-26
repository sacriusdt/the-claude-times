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
  modelOverride?: string;
  providerOverride?: Provider;
}

interface StreamOptions {
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  stream: true;
  modelOverride?: string;
  providerOverride?: Provider;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  openrouter: 'anthropic/claude-sonnet-4-20250514',
};

function getProvider(): Provider {
  return (process.env.AI_PROVIDER as Provider) || 'anthropic';
}

function getModel(providerOverride?: Provider, modelOverride?: string): string {
  if (modelOverride) return modelOverride;
  return process.env.AI_MODEL || DEFAULT_MODELS[providerOverride || getProvider()];
}

// --- Anthropic ---

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function anthropicComplete(opts: CompletionOptions, model: string): Promise<string> {
  const client = getAnthropicClient();
  const system = opts.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const messages = opts.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const response = await client.messages.create({
    model,
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

async function* anthropicStream(opts: StreamOptions, model: string): AsyncGenerator<string> {
  const client = getAnthropicClient();
  const system = opts.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const messages = opts.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const stream = client.messages.stream({
    model,
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

function getOpenAIClient(provider: Provider) {
  if (provider === 'openrouter') {
    return new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function openaiComplete(opts: CompletionOptions, model: string, provider: Provider): Promise<string> {
  const client = getOpenAIClient(provider);
  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.7,
    messages: opts.messages.map(m => ({ role: m.role, content: m.content })),
  });
  return response.choices[0]?.message?.content || '';
}

async function* openaiStream(opts: StreamOptions, model: string, provider: Provider): AsyncGenerator<string> {
  const client = getOpenAIClient(provider);
  const stream = await client.chat.completions.create({
    model,
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
  const provider = opts.providerOverride || getProvider();
  const model = getModel(provider, opts.modelOverride);
  if (provider === 'anthropic') return anthropicComplete(opts, model);
  return openaiComplete(opts, model, provider);
}

export async function* streamComplete(opts: StreamOptions): AsyncGenerator<string> {
  const provider = opts.providerOverride || getProvider();
  const model = getModel(provider, opts.modelOverride);
  if (provider === 'anthropic') yield* anthropicStream(opts, model);
  else yield* openaiStream(opts, model, provider);
}
