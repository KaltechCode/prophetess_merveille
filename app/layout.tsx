import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prophetess Merveille | A Celebration of Grace',
  description:
    'Join Prophetess Merveille for Thanksgiving, her birthday and 10 years in ministry. September 18–19, 2026.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
