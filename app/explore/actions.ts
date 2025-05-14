'use server';

import { revalidatePath } from 'next/cache';
import { getAuth } from '@/lib/auth'; // Assuming getAuth for server-side session
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

// Basic UUID validation regex
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type VoteActionType = 'up' | 'down';

interface VoteResult {
  message?: string;
  newVoteState?: VoteActionType | null;
  error?: string;
  details?: string;
}

export async function voteOnStoreAction(
  storeId: string,
  intendedVote: VoteActionType,
): Promise<VoteResult> {
  const session = await getAuth();

  if (!session?.user?.id) {
    return { error: 'Unauthorized' };
  }
  const userId = session.user.id;
  const userEmail = session.user.email; // Can be null, as in the original route

  if (!UUID_REGEX.test(storeId)) {
    return { error: 'Invalid store ID format' };
  }

  if (!['up', 'down'].includes(intendedVote)) {
    return { error: 'Invalid vote value. Must be "up" or "down".' };
  }

  let dbClient: PoolClient | undefined;
  try {
    dbClient = await pool.connect();
    await dbClient.query('BEGIN'); // Start transaction

    const { rows: currentVoteRows } = await dbClient.query(
      'SELECT vote_type FROM store_votes WHERE store_id = $1 AND user_id = $2',
      [storeId, userId],
    );

    const currentVoteType = currentVoteRows[0]?.vote_type as
      | VoteActionType
      | undefined;

    if (currentVoteType === intendedVote) {
      // User clicked the same vote button again, neutralize vote (delete)
      await dbClient.query(
        'DELETE FROM store_votes WHERE store_id = $1 AND user_id = $2',
        [storeId, userId],
      );
      await dbClient.query('COMMIT'); // Commit transaction
      revalidatePath('/explore'); // Revalidate explore page
      // Potentially revalidate other paths if votes are displayed elsewhere
      return { message: 'Vote removed (neutralized)', newVoteState: null };
    } else {
      // New vote or changing vote (insert or update)
      await dbClient.query(
        `
        INSERT INTO store_votes (store_id, user_id, user_email, vote_type, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (store_id, user_id)
        DO UPDATE SET vote_type = EXCLUDED.vote_type, created_at = CURRENT_TIMESTAMP;
      `,
        [storeId, userId, userEmail, intendedVote],
      );
      await dbClient.query('COMMIT'); // Commit transaction
      revalidatePath('/explore'); // Revalidate explore page
      // Potentially revalidate other paths
      return { message: 'Vote recorded', newVoteState: intendedVote };
    }
  } catch (error: any) {
    if (dbClient) {
      await dbClient.query('ROLLBACK'); // Rollback transaction on error
    }
    console.error(
      `Database error while voting for store ${storeId}, user ${userId} in Server Action:`,
      error,
    );
    // Check for database errors (e.g., store_id not found due to FK constraint)
    if (
      error.code &&
      (error.code.startsWith('23') || error.code.startsWith('22')) // PostgreSQL error codes for integrity constraint violation or data exception
    ) {
      return {
        error: 'Database error, possibly invalid store_id or data.',
        details: error.message,
      };
    }
    return {
      error: 'Internal Server Error',
      details: error.message,
    };
  } finally {
    dbClient?.release();
  }
}
