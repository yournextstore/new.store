import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

export async function GET(request: Request) {
  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Placeholder for database query logic
    console.log(`Fetching stores for user: ${userId}`);

    let dbClient: PoolClient | undefined;
    try {
      dbClient = await pool.connect();
      const result = await dbClient.query(
        'SELECT id, user_id, user_email, prompt_text, store_url, hero_image_url, is_starred, created_at FROM generated_stores WHERE user_id = $1 ORDER BY created_at DESC',
        [userId],
      );

      return NextResponse.json(result.rows, { status: 200 });
    } catch (dbError: any) {
      console.error(
        'Database error while fetching stores for user:',
        userId,
        dbError,
      );
      return NextResponse.json(
        { error: 'Failed to fetch stores', details: dbError.message },
        { status: 500 },
      );
    } finally {
      dbClient?.release();
    }
  } catch (error: any) {
    console.error('Error in GET /api/me/stores:', error);
    // Check if it's an auth specific error or a general one
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
  }
}
