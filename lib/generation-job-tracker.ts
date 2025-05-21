/**
 * @file generation-job-tracker.ts
 * @description This file contains utility functions for managing the lifecycle of AI store generation jobs in the database.
 *
 * Purpose:
 * This module encapsulates the database interactions (SQL queries) related to creating and updating
 * records in the `generation_jobs` table. It provides a clear API for the main generation process
 * (app/api/generate/route.ts) to report the status of a generation job at various stages.
 *
 * Rationale for Creation:
 * These functions were extracted from the main API route handler (app/api/generate/route.ts) to:
 * 1. Centralize database logic: Group all `generation_jobs` table manipulations in one place.
 * 2. Improve readability: Remove repetitive database connection and query boilerplate from the main route.
 * 3. Enhance maintainability: Simplify updates to job tracking logic or schema changes related to job status.
 * 4. Separation of concerns: Isolate database interaction details from the main orchestration logic of the API route.
 *
 * Role:
 * - `initializeJob`: Inserts a new job record with 'queued' status. Throws an error on critical DB failure,
 *   which is expected to be caught by the calling context (e.g., the main API route) and handled
 *   (e.g., by calling `handleGenerationError`).
 * - `updateJobToHeroReady`: Updates an existing job record to 'hero_ready' status, storing the hero content JSON.
 *   Logs DB errors internally and records them on the provided OpenTelemetry span but does not re-throw,
 *   as failure to update status at this stage should not halt the entire generation process.
 * - `updateJobToFullReady`: Updates an existing job record to 'full_ready' status, storing the full store JSON
 *   and the final store URL. Similar to `updateJobToHeroReady`, it logs DB errors internally and records them
 *   on the span but does not re-throw.
 *
 * All functions manage their own database client acquisition and release from the provided pool.
 */
import type { Pool, PoolClient } from 'pg';
import type { Span } from '@opentelemetry/api';

// Renaming to be exported and used by other modules if necessary, removing underscore
export async function initializeJob(
  dbPool: Pool,
  jobId: string,
  userId: string,
  span?: Span,
): Promise<void> {
  let dbClient: PoolClient | null = null;
  try {
    dbClient = await dbPool.connect();
    await dbClient.query(
      `INSERT INTO generation_jobs (id, user_id, status, created_at, updated_at)
       VALUES ($1, $2, 'queued', NOW(), NOW())`,
      [jobId, userId],
    );
    console.log('Job with status "queued" inserted into database:', jobId);
  } catch (dbError) {
    const errorMessage =
      dbError instanceof Error ? dbError.message : String(dbError);
    console.error(
      `Critical error during job initialization for ${jobId}:`,
      errorMessage,
    );
    span?.recordException(
      dbError instanceof Error ? dbError : new Error(errorMessage),
    );
    span?.setAttribute('db.initializeJob.critical_error', true);
    throw dbError;
  } finally {
    dbClient?.release();
  }
}

export async function updateJobToHeroReady(
  dbPool: Pool,
  jobId: string,
  heroJson: any,
  span?: Span,
): Promise<void> {
  let dbClient: PoolClient | null = null;
  try {
    dbClient = await dbPool.connect();
    await dbClient.query(
      `UPDATE generation_jobs SET status = 'hero_ready', hero_json = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(heroJson), jobId],
    );
    console.log('Job with status "hero_ready" updated in database:', jobId);
  } catch (dbError) {
    const errorMessage =
      dbError instanceof Error ? dbError.message : String(dbError);
    console.error(
      `Failed to update job ${jobId} status to hero_ready in database:`,
      errorMessage,
    );
    span?.recordException(
      dbError instanceof Error ? dbError : new Error(errorMessage),
    );
    span?.setAttribute('db.updateJobToHeroReady.error', true);
  } finally {
    dbClient?.release();
  }
}

export async function updateJobToFullReady(
  dbPool: Pool,
  jobId: string,
  fullJson: any,
  storeUrl: string,
  span?: Span,
): Promise<void> {
  let dbClient: PoolClient | null = null;
  try {
    dbClient = await dbPool.connect();
    await dbClient.query(
      `UPDATE generation_jobs
       SET status = 'full_ready', full_json = $1, store_url = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(fullJson), storeUrl, jobId],
    );
    console.log('Job with status "full_ready" updated in database:', jobId);
  } catch (dbError) {
    const errorMessage =
      dbError instanceof Error ? dbError.message : String(dbError);
    console.error(
      `Failed to update job ${jobId} status to full_ready in database:`,
      errorMessage,
    );
    span?.recordException(
      dbError instanceof Error ? dbError : new Error(errorMessage),
    );
    span?.setAttribute('db.updateJobToFullReady.error', true);
  } finally {
    dbClient?.release();
  }
}
