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

// this enum should be in sync with the status column in the generation_jobs table; see @db_schema.sql for details
export type GenerationJobStatus =
  | 'queued'
  | 'hero_ready'
  | 'store_skeleton_ready'
  | 'image_processing'
  | 'images_resolved'
  | 'store_ready'
  | 'failed';

// Renaming to be exported and used by other modules if necessary, removing underscore
export async function initializeJob(
  dbPool: Pool,
  jobId: string,
  userId: string,
  span?: Span,
): Promise<void> {
  let dbClient: PoolClient | null = null;
  const status: GenerationJobStatus = 'queued';
  try {
    dbClient = await dbPool.connect();
    await dbClient.query(
      `INSERT INTO generation_jobs (id, user_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [jobId, userId, status],
    );
    console.log(`Job with status "${status}" inserted into database:`, jobId);
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
  const status: GenerationJobStatus = 'hero_ready';
  try {
    dbClient = await dbPool.connect();
    await dbClient.query(
      `UPDATE generation_jobs SET status = $1, hero_json = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, JSON.stringify(heroJson), jobId],
    );
    console.log(`Job with status "${status}" updated in database:`, jobId);
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

export async function updateJobToStoreSkeletonReady(
  dbPool: Pool,
  jobId: string,
  fullJsonWithPlaceholders: any,
  span?: Span,
): Promise<void> {
  let dbClient: PoolClient | null = null;
  const status: GenerationJobStatus = 'store_skeleton_ready';
  try {
    dbClient = await dbPool.connect();
    await dbClient.query(
      `UPDATE generation_jobs SET status = $1, full_json = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, JSON.stringify(fullJsonWithPlaceholders), jobId],
    );
    console.log(`Job with status "${status}" updated in database:`, jobId);
  } catch (dbError) {
    const errorMessage =
      dbError instanceof Error ? dbError.message : String(dbError);
    console.error(
      `Failed to update job ${jobId} status to store_skeleton_ready in database:`,
      errorMessage,
    );
    span?.recordException(
      dbError instanceof Error ? dbError : new Error(errorMessage),
    );
    span?.setAttribute('db.updateJobToStoreSkeletonReady.error', true);
  } finally {
    dbClient?.release();
  }
}

export async function updateJobToImageProcessing(
  dbPool: Pool,
  jobId: string,
  span?: Span,
): Promise<void> {
  let dbClient: PoolClient | null = null;
  const status: GenerationJobStatus = 'image_processing';
  try {
    dbClient = await dbPool.connect();
    await dbClient.query(
      `UPDATE generation_jobs SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [status, jobId],
    );
    console.log(`Job with status "${status}" updated in database:`, jobId);
  } catch (dbError) {
    const errorMessage =
      dbError instanceof Error ? dbError.message : String(dbError);
    console.error(
      `Failed to update job ${jobId} status to image_processing in database:`,
      errorMessage,
    );
    span?.recordException(
      dbError instanceof Error ? dbError : new Error(errorMessage),
    );
    span?.setAttribute('db.updateJobToImageProcessing.error', true);
  } finally {
    dbClient?.release();
  }
}

export async function updateJobToImagesResolved(
  dbPool: Pool,
  jobId: string,
  fullJsonWithResolvedUrls: any,
  span?: Span,
): Promise<void> {
  let dbClient: PoolClient | null = null;
  const status: GenerationJobStatus = 'images_resolved';
  try {
    dbClient = await dbPool.connect();
    await dbClient.query(
      `UPDATE generation_jobs SET status = $1, full_json = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, JSON.stringify(fullJsonWithResolvedUrls), jobId],
    );
    console.log(`Job with status "${status}" updated in database:`, jobId);
  } catch (dbError) {
    const errorMessage =
      dbError instanceof Error ? dbError.message : String(dbError);
    console.error(
      `Failed to update job ${jobId} status to images_resolved in database:`,
      errorMessage,
    );
    span?.recordException(
      dbError instanceof Error ? dbError : new Error(errorMessage),
    );
    span?.setAttribute('db.updateJobToImagesResolved.error', true);
  } finally {
    dbClient?.release();
  }
}

export async function updateJobToStoreReady(
  dbPool: Pool,
  jobId: string,
  storeUrl: string,
  span?: Span,
): Promise<void> {
  let dbClient: PoolClient | null = null;
  const status: GenerationJobStatus = 'store_ready';
  try {
    dbClient = await dbPool.connect();
    await dbClient.query(
      `UPDATE generation_jobs
       SET status = $1, store_url = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, storeUrl, jobId],
    );
    console.log(`Job with status "${status}" updated in database:`, jobId);
  } catch (dbError) {
    const errorMessage =
      dbError instanceof Error ? dbError.message : String(dbError);
    console.error(
      `Failed to update job ${jobId} status to store_ready in database:`,
      errorMessage,
    );
    span?.recordException(
      dbError instanceof Error ? dbError : new Error(errorMessage),
    );
    span?.setAttribute('db.updateJobToStoreReady.error', true);
  } finally {
    dbClient?.release();
  }
}
