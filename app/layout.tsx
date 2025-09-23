import type { Metadata } from 'next';
import { Inter, Space_Mono } from 'next/font/google';
import { Providers } from './providers';
import { LayoutWrapper } from './layout-wrapper';
import './globals.css';
import '../src/app/brand-colors.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VLANET - AI Video Generator',
  description: 'AI로 영상을 만드는 가장 간단한 방법',
  keywords: ['AI', 'video', 'generator', 'story', 'VLANET'],
  authors: [{ name: 'VLANET Team' }],
  openGraph: {
    title: 'VLANET - AI Video Generator',
    description: 'AI로 영상을 만드는 가장 간단한 방법',
    type: 'website',
    url: 'https://vlanet.io',
    siteName: 'VLANET',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VLANET - AI Video Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VLANET - AI Video Generator',
    description: 'AI로 영상을 만드는 가장 간단한 방법',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${inter.variable} ${spaceMono.variable}`}>
      <body className="bg-black text-white antialiased">
        <Providers>
          <LayoutWrapper>{children}</LayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}