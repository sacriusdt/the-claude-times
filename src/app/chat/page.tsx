import ChatInterface from '@/components/ChatInterface';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Newsroom — The Claude Times',
  robots: 'noindex, nofollow',
};

export default function ChatPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <ChatInterface />
    </div>
  );
}
