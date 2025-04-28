import { type NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db'; // Assuming db connection pool is exported from here
import { z } from 'zod';
import { auth } from '@/lib/auth'; // Import auth
import { headers } from 'next/headers'; // Import headers

// Schema for validating query parameters
const searchParamsSchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12), // Max 100 per page
  imageType: z.enum(['all', 'product', 'hero']).default('all'),
  source: z.string().optional(), // Allow 'all' or specific sources like 'static', 'getimg.ai'
});

// Helper to build WHERE clauses and parameters dynamically
function buildWhereClause(params: z.infer<typeof searchParamsSchema>): {
  whereClause: string;
  queryParams: any[];
} {
  const conditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (params.query) {
    conditions.push(
      `(description ILIKE $${paramIndex} OR filename ILIKE $${paramIndex})`,
    );
    queryParams.push(`%${params.query}%`); // Add wildcards for ILIKE
    paramIndex++;
  }

  if (params.imageType && params.imageType !== 'all') {
    conditions.push(`image_type = $${paramIndex}`);
    queryParams.push(params.imageType);
    paramIndex++;
  }

  if (params.source && params.source !== 'all') {
    conditions.push(`source = $${paramIndex}`);
    queryParams.push(params.source);
    paramIndex++;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, queryParams };
}

export async function GET(request: NextRequest) {
  // Check session first
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const parseResult = searchParamsSchema.safeParse({
      query: searchParams.get('query') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      imageType: searchParams.get('imageType') || undefined,
      source: searchParams.get('source') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parseResult.error.format(),
        },
        { status: 400 },
      );
    }

    const params = parseResult.data;
    const offset = (params.page - 1) * params.limit;

    // --- Database Interaction ---
    if (!pool) {
      console.error('Database pool is not initialized.');
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 },
      );
    }
    const client = await pool.connect();

    try {
      // Build dynamic WHERE clause and parameters
      const { whereClause, queryParams } = buildWhereClause(params);

      // --- Query 1: Get Total Count ---
      const countQuery = `SELECT COUNT(*) FROM images ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams);
      const totalCount = Number.parseInt(countResult.rows[0].count, 10);

      // --- Query 2: Get Paginated Images ---
      const imageQueryParams = [...queryParams]; // Copy params for image query
      imageQueryParams.push(params.limit); // Add limit param
      imageQueryParams.push(offset); // Add offset param

      const imagesQuery = `
        SELECT *
        FROM images
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${queryParams.length + 1}
        OFFSET $${queryParams.length + 2}
      `;
      const imagesResult = await client.query(imagesQuery, imageQueryParams);
      const images = imagesResult.rows;

      // --- Return Response ---
      return NextResponse.json({
        images,
        totalCount,
      });
    } finally {
      client.release(); // Ensure client is always released
    }
  } catch (error) {
    console.error('Error fetching image library:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { error: 'Failed to fetch image library', details: message },
      { status: 500 },
    );
  }
}
