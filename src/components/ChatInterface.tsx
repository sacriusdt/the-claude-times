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

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPassword = password.trim();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: normalizedPassword, message: '__auth_check__' }),
      });
      if (res.ok) {
        setPassword(normalizedPassword);
        setAuthenticated(true);
        setAuthError('');
        const data = await res.json();
        if (data.history) {
          setMessages(data.history);
        }
      } else {
        const data = await res.json().catch(() => ({ error: 'Invalid password' }));
        setAuthError(data.error || 'Invalid password');
      }
    } catch {
      setAuthError('Connection error');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const normalizedPassword = password.trim();

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: normalizedPassword, message: userMessage }),
      });

      if (!res.ok) throw new Error('Chat failed');

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
              if (parsed.deleted) {
                assistantMessage += `\n\n🗑 Article deleted: "${parsed.deleted.title}"`;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                  return updated;
                });
              }
            } catch { /* skip */ }
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
      <div className="min-h-[65vh] flex items-center justify-center">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md bg-brand-light p-8"
          style={{ borderTop: '3px solid #141413', border: '0.5px solid #d4d2c8', borderTopWidth: '3px' }}
        >
          <div className="section-head mb-6" />
          <p className="kicker mb-1">Restricted Desk</p>
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-black italic mb-1">
            Newsroom Access
          </h2>
          <p className="ai-note mb-6">
            <span className="ai-sigil inline-flex mr-1.5">AI</span>
            Editorial console · Jean-Claude
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full px-4 py-3 border border-brand-rule bg-brand-light text-brand-dark placeholder:text-brand-mid focus:outline-none focus:border-brand-dark font-[family-name:var(--font-body)] text-sm"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
          />
          {authError && (
            <p className="mt-2 font-[family-name:var(--font-heading)] italic text-xs font-bold text-brand-mid">
              {authError}
            </p>
          )}
          <button
            type="submit"
            className="mt-4 w-full px-4 py-3 bg-brand-dark text-brand-light font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity"
          >
            Enter Newsroom
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* ── Chat window ── */}
      <div className="chat-container">
        {/* Header */}
        <div className="px-5 py-3 bg-brand-dark text-brand-light flex items-center justify-between gap-3 border-b border-brand-light/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="byline-avatar text-[9px]" style={{ width: 22, height: 22, fontSize: '0.5rem' }}>JC</span>
              <span className="font-[family-name:var(--font-heading)] font-black italic text-sm">Jean-Claude</span>
              <span className="ai-sigil">AI</span>
            </div>
            <p className="ai-note text-brand-light/30 mt-0.5">Senior Correspondent · The Claude Times</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-light/40" />
            <span className="font-[family-name:var(--font-heading)] text-[10px] italic text-brand-light/30">Online</span>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="font-[family-name:var(--font-heading)] italic text-xl font-bold text-brand-dark mb-2">
                Ready for assignment.
              </p>
              <p className="font-[family-name:var(--font-body)] italic text-sm text-brand-mid max-w-md mx-auto leading-relaxed">
                Drop a topic and I&apos;ll draft an article with a clear angle and publication-ready structure.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[86%] px-4 py-3 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                <div className="font-[family-name:var(--font-heading)] text-[9px] uppercase tracking-widest mb-1.5 opacity-50">
                  {msg.role === 'user' ? 'Editor' : 'Jean-Claude'}
                </div>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start mb-3">
              <div className="chat-bubble-assistant px-4 py-3 text-brand-mid">
                <span className="inline-flex gap-1.5">
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
        <div className="p-3 border-t border-brand-rule bg-brand-light">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Assign a story, request a rewrite, steer editorial direction…"
              rows={2}
              className="flex-1 px-4 py-2.5 border border-brand-rule bg-brand-light font-[family-name:var(--font-body)] text-sm resize-none focus:outline-none focus:border-brand-dark"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 bg-brand-dark text-brand-light font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-widest hover:opacity-75 disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
