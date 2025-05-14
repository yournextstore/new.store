'use server';

import { revalidatePath } from 'next/cache';
import { getAuth } from '@/lib/auth';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

// Basic UUID validation regex (simple version)
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface ToggleStarResult {
  id?: string;
  is_starred?: boolean;
  error?: string;
  details?: string;
}

export async function toggleStarAction(
  storeId: string,
): Promise<ToggleStarResult> {
  const session = await getAuth();

  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }
  const userId = session.user.id;

  if (!UUID_REGEX.test(storeId)) {
    return { error: 'Invalid store ID format' };
  }

  let dbClient: PoolClient | undefined;
  try {
    dbClient = await pool.connect();
    const result = await dbClient.query(
      'UPDATE generated_stores SET is_starred = NOT is_starred WHERE id = $1 AND user_id = $2 RETURNING id, is_starred',
      [storeId, userId],
    );

    if (result.rowCount === 0) {
      return { error: 'Store not found or access denied' };
    }

    revalidatePath('/my-stores'); // Revalidate the page to reflect changes
    return result.rows[0]; // Returns { id, is_starred }
  } catch (dbError: any) {
    console.error(
      `Database error while toggling star for store ${storeId}, user ${userId} in Server Action:`,
      dbError,
    );
    return {
      error: 'Failed to update store status',
      details: dbError.message,
    };
  } finally {
    dbClient?.release();
  }
}
