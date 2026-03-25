'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Verify password via API
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, message: '__auth_check__' }),
      });
      if (res.ok) {
        setAuthenticated(true);
        setAuthError('');
        // Load chat history
        const data = await res.json();
        if (data.history) {
          setMessages(data.history);
        }
      } else {
        setAuthError('Invalid password');
      }
    } catch {
      setAuthError('Connection error');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, message: userMessage }),
      });

      if (!res.ok) throw new Error('Chat failed');

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let assistantMessage = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                assistantMessage += parsed.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                  return updated;
                });
              }
              if (parsed.article) {
                assistantMessage += `\n\n📰 Article published: "${parsed.article.title}"\n→ /article/${parsed.article.slug}`;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                  return updated;
                });
              }
            } catch {
              // Skip unparseable chunks
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${(err as Error).message}` },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <form onSubmit={handleLogin} className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
              Newsroom Access
            </h2>
            <p className="text-sm text-brand-mid mt-1">
              Enter the admin password to chat with Jean-Claude
            </p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 border border-brand-subtle rounded-sm bg-white text-brand-dark placeholder:text-brand-mid/50 focus:outline-none focus:border-brand-orange transition-colors"
            autoFocus
          />
          {authError && (
            <p className="mt-2 text-sm text-brand-orange">{authError}</p>
          )}
          <button
            type="submit"
            className="mt-3 w-full px-4 py-3 bg-brand-dark text-brand-light font-[family-name:var(--font-heading)] text-sm font-medium rounded-sm hover:bg-brand-dark/90 transition-colors"
          >
            Enter Newsroom
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-container border border-brand-subtle rounded-sm bg-white">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-brand-subtle flex items-center justify-between">
        <div>
          <h3 className="font-[family-name:var(--font-heading)] font-semibold text-sm">
            Jean-Claude &mdash; Newsroom
          </h3>
          <p className="text-xs text-brand-mid">
            Ask me to write an article, discuss story ideas, or just chat.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-green" />
          <span className="text-xs text-brand-mid">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="text-center py-12 text-brand-mid">
            <p className="font-[family-name:var(--font-heading)] text-lg">
              Bonjour.
            </p>
            <p className="mt-1 text-sm">
              What&apos;s on your mind? Give me a topic and I&apos;ll write you something worth reading.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start mb-3">
            <div className="chat-bubble-assistant px-4 py-3 text-sm text-brand-mid">
              <span className="inline-flex gap-1">
                <span className="animate-pulse">●</span>
                <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-brand-subtle">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 px-4 py-2.5 border border-brand-subtle rounded-sm bg-brand-light text-sm resize-none focus:outline-none focus:border-brand-orange transition-colors"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-brand-orange text-white font-[family-name:var(--font-heading)] text-sm font-medium rounded-sm hover:bg-brand-orange/90 disabled:opacity-40 transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
