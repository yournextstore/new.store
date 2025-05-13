import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

// Basic UUID validation regex
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET(request: Request) {
  let dbClient: PoolClient | undefined;
  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user?.id) {
      // Return an empty object or specific status if unauthenticated,
      // as the client might call this speculatively.
      // Or, client should check auth status first before calling.
      // For now, strict 401 is fine.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    dbClient = await pool.connect();
    // Fetches all votes for the given user_id
    const query = `
      SELECT store_id, vote_type
      FROM store_votes
      WHERE user_id = $1;
    `;

    const result = await dbClient.query(query, [userId]);

    const userVotes: { [storeId: string]: 'up' | 'down' } = {};
    result.rows.forEach((row) => {
      userVotes[row.store_id] = row.vote_type;
    });

    return NextResponse.json(userVotes, { status: 200 });
  } catch (error: any) {
    console.error('Error in GET /api/me/votes:', error);
    // Check for auth specific error (though session check should catch it)
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
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 },
    );
  } finally {
    dbClient?.release();
  }
}
