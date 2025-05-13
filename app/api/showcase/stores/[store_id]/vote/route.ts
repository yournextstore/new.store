import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

// Basic UUID validation regex
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

type VoteAction = 'up' | 'down';

interface VoteRequestBody {
  vote: VoteAction;
}

export async function POST(
  request: Request,
  context: { params: { store_id: string } },
) {
  let dbClient: PoolClient | undefined;
  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const userEmail = session.user.email; // Can be null

    const store_id = context.params.store_id;

    if (!UUID_REGEX.test(store_id)) {
      return NextResponse.json(
        { error: 'Invalid store ID format' },
        { status: 400 },
      );
    }

    let requestBody: VoteRequestBody;
    try {
      requestBody = await request.json();
      if (!['up', 'down'].includes(requestBody.vote)) {
        throw new Error('Invalid vote value. Must be "up" or "down".');
      }
    } catch (e: any) {
      return NextResponse.json(
        { error: 'Invalid request body', details: e.message },
        { status: 400 },
      );
    }

    const intendedVote = requestBody.vote;

    dbClient = await pool.connect();
    await dbClient.query('BEGIN'); // Start transaction

    const { rows: currentVoteRows } = await dbClient.query(
      'SELECT vote_type FROM store_votes WHERE store_id = $1 AND user_id = $2',
      [store_id, userId],
    );

    const currentVoteType = currentVoteRows[0]?.vote_type as
      | VoteAction
      | undefined;

    if (currentVoteType === intendedVote) {
      // User clicked the same vote button again, neutralize vote (delete)
      await dbClient.query(
        'DELETE FROM store_votes WHERE store_id = $1 AND user_id = $2',
        [store_id, userId],
      );
      await dbClient.query('COMMIT'); // Commit transaction
      return NextResponse.json(
        { message: 'Vote removed (neutralized)', newVoteState: null },
        { status: 200 },
      );
    } else {
      // New vote or changing vote (insert or update)
      // ON CONFLICT handles both new votes and changing existing votes (e.g., up to down)
      // It also updates created_at to reflect the latest interaction time.
      await dbClient.query(
        `
        INSERT INTO store_votes (store_id, user_id, user_email, vote_type, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (store_id, user_id)
        DO UPDATE SET vote_type = EXCLUDED.vote_type, created_at = CURRENT_TIMESTAMP;
      `,
        [store_id, userId, userEmail, intendedVote],
      );
      await dbClient.query('COMMIT'); // Commit transaction
      return NextResponse.json(
        { message: 'Vote recorded', newVoteState: intendedVote },
        { status: 200 },
      );
    }
  } catch (error: any) {
    if (dbClient) {
      await dbClient.query('ROLLBACK'); // Rollback transaction on error
    }
    console.error(
      `Error in POST /api/showcase/stores/${context.params.store_id}/vote:`,
      error,
    );
    // Check for auth specific error, though session check should catch most
    if (
      error.type === 'AUTH_API_ERROR' ||
      error.name === 'AuthError' ||
      error.constructor?.name === 'AuthError'
    ) {
      return NextResponse.json(
        { error: 'Authentication error', details: error.message },
        { status: 401 },
      );
    }
    // Check for database errors (e.g., store_id not found due to FK constraint)
    if (
      error.code &&
      (error.code.startsWith('23') || error.code.startsWith('22'))
    ) {
      // PostgreSQL error codes for integrity constraint violation or data exception
      return NextResponse.json(
        {
          error: 'Database error, possibly invalid store_id or data.',
          details: error.message,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 },
    );
  } finally {
    dbClient?.release();
  }
}
