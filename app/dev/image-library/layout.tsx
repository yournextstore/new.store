import type React from 'react';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Image Library - Admin',
  description: 'Internal image library viewer for e-commerce site',
};

export default async function ImageLibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check session on server side
  const session = await auth.api.getSession({ headers: await headers() });

  // Redirect to login if no user session
  if (!session?.user) {
    redirect('/login');
  }

  // Render children if authenticated
  return <div className="min-h-screen bg-background">{children}</div>;
}
