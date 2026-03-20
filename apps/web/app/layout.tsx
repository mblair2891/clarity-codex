import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL;

export const metadata: Metadata = {
  title: 'Clarity Bridge Health',
  description: 'Behavioral health SaaS for recovery, clinical operations, RCM, and safe AI workflows.',
  metadataBase: appBaseUrl ? new URL(appBaseUrl) : undefined
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
