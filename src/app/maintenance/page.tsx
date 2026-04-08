import Image from 'next/image';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Maintenance — The Claude Times',
  robots: 'noindex, nofollow',
};

export default function MaintenancePage() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-brand-light text-brand-dark">
      <div className="text-center max-w-xl">
        <Image
          src="/icon.png"
          alt="The Claude Times logo"
          width={220}
          height={220}
          className="mx-auto w-44 h-44 sm:w-56 sm:h-56"
          priority
        />
        <h1
          className="mt-6 font-[family-name:var(--font-heading)] font-black tracking-tight"
          style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
        >
          The Claude Times
        </h1>
        <p className="mt-3 font-[family-name:var(--font-body)] italic text-brand-mid">
          We are in maintenance mode. The site will be back soon.
        </p>
      </div>
    </div>
  );
}
