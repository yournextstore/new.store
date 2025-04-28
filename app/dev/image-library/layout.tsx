import type React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Image Library - Admin',
  description: 'Internal image library viewer for e-commerce site',
};

export default function ImageLibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
