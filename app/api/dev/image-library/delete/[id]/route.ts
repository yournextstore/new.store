import { type NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { del } from '@vercel/blob'; // Import Vercel Blob deletion function
import { z } from 'zod';

// Schema for validating the ID from the route segment
const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  console.time('delete_request_time');

  // --- Authentication ---
  console.time('auth_getSession_delete');
  const session = await auth.api.getSession({ headers: await headers() });
  console.timeEnd('auth_getSession_delete');
  if (!session?.user) {
    console.timeEnd('delete_request_time');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Validate ID ---
  const resolvedParams = await context.params; // Await the params
  const parseResult = paramsSchema.safeParse(resolvedParams); // Validate the resolved params
  if (!parseResult.success) {
    console.timeEnd('delete_request_time');
    return NextResponse.json(
      {
        error: 'Invalid image ID format',
        details: parseResult.error.format(),
      },
      { status: 400 },
    );
  }
  const { id: imageId } = parseResult.data;

  // --- Database Interaction ---
  if (!pool) {
    console.error('Database pool is not initialized.');
    console.timeEnd('delete_request_time');
    return NextResponse.json(
      { error: 'Database connection error' },
      { status: 500 },
    );
  }
  console.time('db_connect_delete');
  const client = await pool.connect();
  console.timeEnd('db_connect_delete');

  try {
    // --- Begin Transaction ---
    console.time('db_transaction_begin');
    await client.query('BEGIN');
    console.timeEnd('db_transaction_begin');

    // --- 1. Fetch blob_pathname before deleting from DB ---
    console.time('db_fetch_pathname');
    const selectQuery =
      'SELECT blob_pathname FROM images WHERE id = $1 FOR UPDATE'; // Lock row
    const selectResult = await client.query(selectQuery, [imageId]);
    console.timeEnd('db_fetch_pathname');

    if (selectResult.rows.length === 0) {
      await client.query('ROLLBACK'); // Rollback if image not found
      console.timeEnd('delete_request_time');
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    const blobPathname = selectResult.rows[0].blob_pathname;

    // --- 2. Delete from Database ---
    console.time('db_delete_image');
    const deleteQuery = 'DELETE FROM images WHERE id = $1';
    const deleteResult = await client.query(deleteQuery, [imageId]);
    console.timeEnd('db_delete_image');

    if (deleteResult.rowCount === 0) {
      // Should not happen if row was locked, but good practice to check
      await client.query('ROLLBACK');
      console.error(`Failed to delete image record with ID: ${imageId}`);
      console.timeEnd('delete_request_time');
      return NextResponse.json(
        { error: 'Failed to delete image from database' },
        { status: 500 },
      );
    }

    // --- 3. Delete from Vercel Blob ---
    let blobDeleted = false;
    if (blobPathname) {
      try {
        console.time('vercel_blob_delete');
        await del(blobPathname); // Use the pathname for deletion
        console.timeEnd('vercel_blob_delete');
        blobDeleted = true;
      } catch (blobError) {
        // Log the error but proceed to commit DB transaction
        console.error(
          `Failed to delete image from Vercel Blob (${blobPathname}):`,
          blobError,
        );
        // Decide if this should be a hard failure (rollback) or just a warning
        // For now, we log and continue, assuming DB deletion is primary.
      }
    }

    // --- Commit Transaction ---
    console.time('db_transaction_commit');
    await client.query('COMMIT');
    console.timeEnd('db_transaction_commit');

    console.timeEnd('delete_request_time');
    return NextResponse.json({
      message: 'Image deleted successfully',
      blobDeleted: blobDeleted,
    });
  } catch (error) {
    // --- Rollback on any error during transaction ---
    await client.query('ROLLBACK');
    console.error('Error deleting image:', error);
    const message =
      error instanceof Error ? error.message : 'Unknown server error';
    console.timeEnd('delete_request_time');
    return NextResponse.json(
      { error: 'Failed to delete image', details: message },
      { status: 500 },
    );
  } finally {
    console.time('db_release_delete');
    client.release();
    console.timeEnd('db_release_delete');
  }
}
