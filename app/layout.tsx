import type { Metadata } from 'next';
import PwaRegistration from './PwaRegistration';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'DJ Request List', template: '%s · DJ Request List' },
  description: 'Send a song request straight to the DJ booth.',
  manifest: '/manifest.webmanifest',
  applicationName: 'DJ Request List',
  appleWebApp: { capable: true, title: 'DJ Requests', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'DJ Request List',
    description: 'Send a song straight to the DJ booth.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'DJ Request List' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DJ Request List',
    description: 'Send a song straight to the DJ booth.',
    images: ['/og.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a090d',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
