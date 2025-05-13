import type { Metadata } from 'next';
import MyStoresClient from './my-stores-client';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'My Stores | Store Generator',
  description: 'View and manage your generated stores',
};

// No Store interface needed here anymore as data is fetched client-side
// No getMyStores function needed here anymore

export default async function MyStoresPage() {
  const requestHeadersForSession = await headers();
  const session = await auth.api.getSession({
    headers: requestHeadersForSession,
  });

  if (!session?.user) {
    redirect('/sign-in'); // Or your app's sign-in page
  }

  // MyStoresClient will now fetch its own data
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">My Stores</h1>
      <p className="text-muted-foreground mb-8">
        View and manage all the stores you've generated. Star your favorites for
        easy access.
      </p>
      <MyStoresClient />
    </div>
  );
}
