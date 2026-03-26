'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Journalist = 'jean-claude' | 'sophia';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const JOURNALISTS = {
  'jean-claude': {
    name: 'Jean-Claude',
    initials: 'JC',
    role: 'Senior Correspondent',
    placeholder: 'Assign a story, request a rewrite, steer editorial direction…',
    greeting: { title: 'Ready for assignment.', sub: "Drop a topic and I'll draft an article with a clear angle and publication-ready structure." },
  },
  sophia: {
    name: 'Sophia',
    initials: 'S',
    role: 'Breaking News Desk',
    placeholder: "What's the story? I'll get on it fast…",
    greeting: { title: "What's breaking?", sub: "Give me a topic or a link and I'll turn it into something worth reading. Fast." },
  },
};

export default function ChatInterface() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [journalist, setJournalist] = useState<Journalist>('jean-claude');
  const [messagesByJournalist, setMessagesByJournalist] = useState<Record<Journalist, Message[]>>({
    'jean-claude': [],
    sophia: [],
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = messagesByJournalist[journalist];
  const j = JOURNALISTS[journalist];

  const setMessages = (updater: (prev: Message[]) => Message[]) => {
    setMessagesByJournalist(prev => ({
      ...prev,
      [journalist]: updater(prev[journalist]),
    }));
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const loadHistory = async (j: Journalist, pwd: string) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd, message: '__auth_check__', journalist: j }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.history) {
          setMessagesByJournalist(prev => ({ ...prev, [j]: data.history }));
        }
      }
    } catch { /* ignore */ }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, message: '__auth_check__', journalist: 'jean-claude' }),
      });
      if (res.ok) {
        setAuthenticated(true);
        setAuthError('');
        const data = await res.json();
        if (data.history) {
          setMessagesByJournalist(prev => ({ ...prev, 'jean-claude': data.history }));
        }
        // Pre-load Sophia's history too
        loadHistory('sophia', password);
      } else {
        setAuthError('Invalid password');
      }
    } catch {
      setAuthError('Connection error');
    }
  };

  const handleJournalistSwitch = (j: Journalist) => {
    setJournalist(j);
    // Load history for this journalist if not yet loaded
    if (messagesByJournalist[j].length === 0) {
      loadHistory(j, password);
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
        body: JSON.stringify({ password, message: userMessage, journalist }),
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
            Editorial console · Jean-Claude &amp; Sophia
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full px-4 py-3 border border-brand-rule bg-brand-light text-brand-dark placeholder:text-brand-mid focus:outline-none focus:border-brand-dark font-[family-name:var(--font-body)] text-sm"
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
      {/* ── Journalist switcher tabs ── */}
      <div className="flex border-b border-brand-rule mb-6">
        {(Object.entries(JOURNALISTS) as [Journalist, typeof JOURNALISTS[Journalist]][]).map(([key, info]) => (
          <button
            key={key}
            onClick={() => handleJournalistSwitch(key)}
            className={`flex items-center gap-2.5 px-5 py-3 font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${
              journalist === key
                ? 'border-brand-dark text-brand-dark'
                : 'border-transparent text-brand-mid hover:text-brand-dark'
            }`}
          >
            <span className="byline-avatar text-[9px]" style={{ width: 22, height: 22, fontSize: '0.5rem' }}>
              {info.initials}
            </span>
            {info.name}
          </button>
        ))}
      </div>

      {/* ── Chat window ── */}
      <div className="chat-container">
        {/* Header */}
        <div className="px-5 py-3 bg-brand-dark text-brand-light flex items-center justify-between gap-3 border-b border-brand-light/10">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="font-[family-name:var(--font-heading)] font-black italic text-sm">{j.name}</span>
              <span className="ai-sigil">AI</span>
            </div>
            <p className="ai-note text-brand-light/30 mt-0.5">{j.role} · The Claude Times</p>
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
                {j.greeting.title}
              </p>
              <p className="font-[family-name:var(--font-body)] italic text-sm text-brand-mid max-w-md mx-auto leading-relaxed">
                {j.greeting.sub}
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[86%] px-4 py-3 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
                <div className="font-[family-name:var(--font-heading)] text-[9px] uppercase tracking-widest mb-1.5 opacity-50">
                  {msg.role === 'user' ? 'Editor' : j.name}
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
              placeholder={j.placeholder}
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
