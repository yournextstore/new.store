import type { Metadata } from 'next';
import MyStoresClient from './my-stores-client';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

export const metadata: Metadata = {
  title: 'My Stores | Store Generator',
  description: 'View and manage your generated stores',
};

// Define the Store interface, similar to how it's in my-stores-client.tsx
// and consistent with the data fetched.
interface Store {
  id: string;
  user_id: string; // Kept from DB query, though not directly used by client yet
  user_email: string; // Kept from DB query
  prompt_text: string;
  store_url: string;
  hero_image_url: string | null;
  is_starred: boolean;
  created_at: string;
}

async function getMyStores(
  userId: string,
): Promise<{ stores: Store[]; error?: string }> {
  let dbClient: PoolClient | undefined;
  try {
    dbClient = await pool.connect();
    const result = await dbClient.query<Store>(
      'SELECT id, user_id, user_email, prompt_text, store_url, hero_image_url, is_starred, created_at FROM generated_stores WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return { stores: result.rows };
  } catch (dbError: any) {
    console.error(
      'Database error while fetching stores for user in MyStoresPage:',
      userId,
      dbError,
    );
    return {
      stores: [],
      error: 'Failed to fetch stores. Please try again later.',
    };
  } finally {
    dbClient?.release();
  }
}

export default async function MyStoresPage() {
  const requestHeadersForSession = await headers();
  const session = await auth.api.getSession({
    headers: requestHeadersForSession,
  });

  if (!session?.user?.id) {
    // Check for user.id as well
    redirect('/sign-in'); // Or your app's sign-in page
  }

  const userId = session.user.id;
  const { stores, error: fetchError } = await getMyStores(userId);

  // MyStoresClient will now receive data as props
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">My Stores</h1>
      <p className="text-muted-foreground mb-8">
        View and manage all the stores you've generated. Star your favorites for
        easy access.
      </p>
      <MyStoresClient
        initialStores={stores}
        initialFetchError={fetchError || null}
      />
    </div>
  );
}
