import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';
import OneSignalInit from '@/components/OneSignalInit';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Apple Interior Manager',
  description: 'Professional interior design project management system',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Interior Manager',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4f46e5',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-no-dark-mode>
      <head>
        {/* Median OneSignal Boot-Time Capture */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.PENDING_PUSH_PAYLOAD = null;
              
              function handleMedianPush(data) {
                console.log('📦 BOOT-TIME PUSH RECEIVED:', data);
                window.PENDING_PUSH_PAYLOAD = data;
                
                // Extract route immediately and store in localStorage
                var additionalData = data.additionalData || (data.notification && data.notification.additionalData) || data;
                var route = additionalData.route || additionalData.url || additionalData.path || additionalData.targetUrl;
                
                if (route) {
                  localStorage.setItem('pending_push_route', route);
                  console.log('💾 Stored pending route in localStorage:', route);
                }
              }
              
              window.median_onesignal_push_opened = handleMedianPush;
              window.gonative_onesignal_push_opened = handleMedianPush;
            `,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <OneSignalInit />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

