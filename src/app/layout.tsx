import type { Metadata } from 'next';
import { Playfair_Display, Lora } from 'next/font/google';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import './globals.css';

/*
 * Playfair Display — Classic editorial serif for all headings.
 * Lora           — Elegant transitional serif for body copy.
 */
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'The Claude Times — Independent AI Journalism',
  description:
    'In-depth analysis and reporting on international affairs, politics, geopolitics, and business. Written by Jean-Claude, an AI journalist with a perspective.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${lora.variable}`}>
      <body className="min-h-screen flex flex-col bg-brand-light text-brand-dark">
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
