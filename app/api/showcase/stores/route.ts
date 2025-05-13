import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';

const DEFAULT_PAGE_LIMIT = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get('page') || '1', 10);
  const limit = Number.parseInt(
    searchParams.get('limit') || DEFAULT_PAGE_LIMIT.toString(),
    10,
  );

  if (Number.isNaN(page) || page < 1) {
    return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
  }
  if (Number.isNaN(limit) || limit < 1 || limit > 100) {
    // Max limit of 100
    return NextResponse.json(
      { error: 'Invalid limit value. Must be between 1 and 100.' },
      { status: 400 },
    );
  }

  const offset = (page - 1) * limit;

  let dbClient: PoolClient | undefined;
  try {
    dbClient = await pool.connect();

    // Query to get stores with their net vote counts and total count for pagination
    const storesQuery = `
      SELECT
        gs.id,
        gs.user_id AS "creatorUserId",
        gs.user_email AS "creatorUserEmail",
        gs.prompt_text AS "promptText",
        gs.store_url AS "storeUrl",
        gs.hero_image_url AS "heroImageUrl",
        gs.is_starred AS "isStarred", -- Retaining for potential future use by client, though not primary for showcase
        gs.created_at AS "createdAt",
        COALESCE(SUM(CASE WHEN sv.vote_type = 'up' THEN 1 WHEN sv.vote_type = 'down' THEN -1 ELSE 0 END), 0) AS "netVotes"
      FROM
        generated_stores gs
      LEFT JOIN
        store_votes sv ON gs.id = sv.store_id
      GROUP BY
        gs.id
      ORDER BY
        gs.created_at DESC
      LIMIT $1
      OFFSET $2;
    `;

    const totalStoresQuery = 'SELECT COUNT(*) FROM generated_stores;';

    const [storesResult, totalResult] = await Promise.all([
      dbClient.query(storesQuery, [limit, offset]),
      dbClient.query(totalStoresQuery),
    ]);

    const totalStores = Number.parseInt(totalResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalStores / limit);

    return NextResponse.json(
      {
        data: storesResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalStores,
          itemsPerPage: limit,
        },
      },
      { status: 200 },
    );
  } catch (dbError: any) {
    console.error('Database error while fetching showcase stores:', dbError);
    return NextResponse.json(
      { error: 'Failed to fetch showcase stores', details: dbError.message },
      { status: 500 },
    );
  } finally {
    dbClient?.release();
  }
}
