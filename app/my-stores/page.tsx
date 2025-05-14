import type { Metadata } from 'next';
import MyStoresClient from './my-stores-client';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';
import type { Store } from './types';

export const metadata: Metadata = {
  title: 'My Stores | Store Generator',
  description: 'View and manage your generated stores',
};

async function getMyStores(
  userId: string,
): Promise<{ stores: Store[]; error?: string }> {
  let dbClient: PoolClient | undefined;
  try {
    dbClient = await pool.connect();
    // Assuming generated_stores table has columns matching the Store type
    // and hero_title, hero_description might be null or not present in DB
    // For now, selecting fields that are definitely in the DB.
    // We might need to adjust the query if hero_title/description are stored.
    const result = await dbClient.query<Store>(
      `SELECT 
          id, 
          user_id, 
          prompt_text, 
          store_url, 
          hero_image_url, 
          is_starred, 
          created_at,
          user_email
          -- If hero_title and hero_description are in the DB, add them here
          -- hero_title, 
          -- hero_description
       FROM generated_stores 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId],
    );
    // Ensure created_at is string (ISO format) as expected by Store type
    const stores = result.rows.map((store) => ({
      ...store,
      created_at: new Date(store.created_at).toISOString(),
      // hero_image_url can be null from db, which matches our Store type
    }));
    return { stores };
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
  // Safely get session, prefer getAuth for Server Components if available and suitable
  const session = await auth.api.getSession({
    headers: requestHeadersForSession,
  });

  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  const userId = session.user.id;
  const { stores, error: fetchError } = await getMyStores(userId);

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">My Stores</h1>
      <p className="text-muted-foreground mb-8">
        View and manage all the stores you've generated. Star your favorites for
        easy access.
      </p>
      {/* MyStoresClient will receive data and handle logic, then render StoreGrid */}
      <MyStoresClient
        initialStores={stores}
        initialFetchError={fetchError || null}
      />
    </div>
  );
}
