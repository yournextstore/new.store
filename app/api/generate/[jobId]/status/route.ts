import { NextResponse } from 'next/server';
import { pool } from '@/lib/db'; // Assuming shared DB pool
import type { PoolClient } from 'pg'; // Import PoolClient for typing
// import type { NextApiRequest } from 'next'; // Not strictly needed for App Router with Request object

interface StatusResponse {
  status: string;
  hero_json?: any; // Consider defining a more specific type e.g., HeroContentTurn1 from route.ts
  store_url?: string;
  error_msg?: string;
}

// Define a type for the context parameters for App Router route handlers
interface RouteContext {
  params: {
    jobId: string;
  };
}

export async function GET(request: Request, context: RouteContext) {
  // Address Next.js error: "params should be awaited before using its properties"
  const awaitedParams = await context.params;
  const { jobId } = awaitedParams;

  if (!jobId || typeof jobId !== 'string') {
    return NextResponse.json(
      { error: 'Job ID is required and must be a string' },
      { status: 400 },
    );
  }

  // Validate if jobId is a UUID (RFC 4122)
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(jobId)) {
    return NextResponse.json(
      { error: 'Invalid Job ID format. Must be a valid UUID.' },
      { status: 400 },
    );
  }

  let dbClient: PoolClient | undefined;
  try {
    dbClient = await pool.connect();
    const result = await dbClient.query(
      `SELECT status, hero_json, store_url, error_msg
       FROM generation_jobs
       WHERE id = $1`,
      [jobId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = result.rows[0];
    const response: StatusResponse = {
      status: job.status,
    };

    // hero_json is already an object if present, as it's stored as JSONB
    if (job.hero_json !== null && job.hero_json !== undefined) {
      response.hero_json = job.hero_json;
    }
    if (job.store_url) {
      response.store_url = job.store_url;
    }
    if (job.error_msg) {
      response.error_msg = job.error_msg;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Failed to fetch job status for ${jobId}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    // Add a more specific attribute to the log for easier tracing
    console.error(`JobStatusFetchError for ${jobId}`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: 'Could not fetch job status.',
      },
      { status: 500 },
    );
  } finally {
    dbClient?.release();
  }
}
