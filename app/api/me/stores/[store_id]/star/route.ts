import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

// Basic UUID validation regex (simple version)
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface PatchParams {
  params: {
    store_id: string;
  };
}

export async function PATCH(request: Request, { params }: PatchParams) {
  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const { store_id } = params;

    if (!UUID_REGEX.test(store_id)) {
      return NextResponse.json(
        { error: 'Invalid store ID format' },
        { status: 400 },
      );
    }

    let dbClient: PoolClient | undefined;
    try {
      dbClient = await pool.connect();
      const result = await dbClient.query(
        'UPDATE generated_stores SET is_starred = NOT is_starred WHERE id = $1 AND user_id = $2 RETURNING id, is_starred',
        [store_id, userId],
      );

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: 'Store not found or access denied' },
          { status: 404 },
        );
      }

      return NextResponse.json(result.rows[0], { status: 200 }); // Returns { id, is_starred }
    } catch (dbError: any) {
      console.error(
        `Database error while toggling star for store ${store_id}, user ${userId}:`,
        dbError,
      );
      return NextResponse.json(
        { error: 'Failed to update store status', details: dbError.message },
        { status: 500 },
      );
    } finally {
      dbClient?.release();
    }
  } catch (error: any) {
    console.error('Error in PATCH /api/me/stores/[store_id]/star:', error);
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
