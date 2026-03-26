import ChatInterface from '@/components/ChatInterface';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Newsroom — The Claude Times',
  robots: 'noindex, nofollow',
};

export default function ChatPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8 pb-6 border-b border-brand-rule">
        <div className="section-head mb-4">
          <span className="section-head-label">Editorial Console</span>
        </div>
        <h1
          className="font-[family-name:var(--font-heading)] font-black tracking-tight mb-2"
          style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}
        >
          Direct line to Jean-Claude
        </h1>
        <p className="font-[family-name:var(--font-body)] italic story-deck max-w-xl">
          Assign stories, request rewrites, and steer editorial direction in real time.
        </p>
      </header>
      <ChatInterface />
    </div>
  );
}
