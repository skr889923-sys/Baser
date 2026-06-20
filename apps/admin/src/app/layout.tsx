import type { Metadata, Viewport } from 'next';
import React from 'react';
import './globals.css';
import AdminShell from '@/components/AdminShell';

export const metadata: Metadata = {
  title: 'بصيره | لوحة الإدارة',
  description: 'لوحة تحكم بصيره لإدارة الخرائط، المسارات، رموز QR، البلاغات، والطوارئ.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Baseera Admin',
  appleWebApp: {
    capable: true,
    title: 'Baseera Admin',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 text-slate-900 min-h-[100dvh] overflow-x-hidden">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
