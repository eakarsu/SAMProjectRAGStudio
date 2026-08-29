import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ProcureScope — SAM Project RAG Studio',
  description: 'Project-isolated RAG, requirements intelligence, and governed AI proposal generation for every SAM.gov opportunity.',
  openGraph: {
    title: 'ProcureScope — SAM Project RAG Studio',
    description: 'Give every SAM.gov opportunity its own evidence-grounded RAG, requirements matrix, and proposal workflow.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Isolated document evidence flowing into one secure project workspace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ProcureScope — SAM Project RAG Studio',
    description: 'Project-isolated federal opportunity intelligence and governed proposal generation.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
