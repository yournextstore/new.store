import { Suspense } from 'react';
import { getAuth } from '@/lib/auth';
import { pool } from '@/lib/db';
import type { PoolClient } from 'pg';
import type { Store, PaginatedStoresResponse, UserVotesMap } from '@/lib/types';
import ExploreClient from './explore-client';
import { StoreGallerySkeleton } from '@/components/store-gallery'; // Assuming a skeleton component exists

const STORES_PER_PAGE = 9;

async function getShowcaseStores(
  page: number,
  limit: number,
): Promise<
  Omit<PaginatedStoresResponse, 'data'> & { stores: Store[]; error?: string }
> {
  const offset = (page - 1) * limit;
  let dbClient: PoolClient | undefined;

  try {
    dbClient = await pool.connect();
    const storesQuery = `
      SELECT
        gs.id,
        gs.user_id AS "creatorUserId",
        gs.user_email AS "creatorUserEmail",
        gs.prompt_text AS "promptText",
        gs.store_url AS "storeUrl",
        gs.hero_image_url AS "heroImageUrl",
        gs.is_starred AS "isStarred",
        gs.created_at AS "createdAt",
        COALESCE(SUM(CASE WHEN sv.vote_type = 'up' THEN 1 WHEN sv.vote_type = 'down' THEN -1 ELSE 0 END), 0)::INTEGER AS "netVotes"
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

    return {
      stores: storesResult.rows as Store[],
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalStores,
        itemsPerPage: limit,
      },
    };
  } catch (dbError: any) {
    console.error(
      'Database error while fetching showcase stores for ExplorePage:',
      dbError,
    );
    return {
      stores: [],
      pagination: {
        currentPage: page,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: limit,
      },
      error: 'Failed to fetch showcase stores. Please try again later.',
    };
  } finally {
    dbClient?.release();
  }
}

async function getUserVotes(
  userId: string | undefined,
): Promise<{ userVotes: UserVotesMap; error?: string }> {
  if (!userId) return { userVotes: {} };
  let dbClient: PoolClient | undefined;
  try {
    dbClient = await pool.connect();
    const query = `
      SELECT store_id, vote_type
      FROM store_votes
      WHERE user_id = $1;
    `;
    const result = await dbClient.query(query, [userId]);
    const votes: UserVotesMap = {};
    result.rows.forEach((row) => {
      votes[row.store_id] = row.vote_type;
    });
    return { userVotes: votes };
  } catch (error: any) {
    console.error(
      'Database error while fetching user votes for ExplorePage:',
      error,
    );
    return {
      userVotes: {},
      error: 'Failed to fetch your votes. Please try again later.',
    };
  } finally {
    dbClient?.release();
  }
}

interface ExplorePageProps {
  searchParams: {
    page?: string;
    // We might add server-side search later, but client search is already there
  };
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const resolvedSearchParams = await searchParams; // Await searchParams
  const currentPage = Number.parseInt(resolvedSearchParams.page || '1', 10);
  // Validate currentPage server-side if desired, or rely on client/db logic for now

  const session = await getAuth();
  const userId = session?.user?.id;

  // Fetch stores and user votes in parallel
  const [storesData, votesData] = await Promise.all([
    getShowcaseStores(currentPage, STORES_PER_PAGE),
    getUserVotes(userId),
  ]);

  const initialStores = storesData.stores.map((store) => ({
    ...store,
    userVote: votesData.userVotes[store.id] || null,
  }));

  const overallError = storesData.error || votesData.error;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Explore Stores</h1>
          <p className="text-muted-foreground">
            Discover and vote on stores created by the community
          </p>
        </div>
        {/* 
          The ExploreClient will handle search input, displaying stores, pagination UI, and voting. 
          It receives all necessary initial data as props.
        */}
        <Suspense fallback={<StoreGallerySkeleton count={STORES_PER_PAGE} />}>
          <ExploreClient
            initialStores={initialStores}
            initialPagination={storesData.pagination}
            initialUserVotes={votesData.userVotes} // Could be merged into initialStores but separate is fine
            isAuthenticated={!!userId}
            initialError={overallError || null}
            // searchParams are available to client via useSearchParams if needed for client-side routing on pagination
          />
        </Suspense>
      </div>
    </div>
  );
}
