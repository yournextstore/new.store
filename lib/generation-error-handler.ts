/**
 * @file generation-error-handler.ts
 * @description This file contains a centralized error handling utility for the AI store generation process.
 *
 * Purpose:
 * The primary purpose of this module is to provide a consistent way to handle errors that occur
 * during the multi-step store generation API call (app/api/generate/route.ts). It standardizes
 * error logging, OpenTelemetry span updates, updating the corresponding generation job in the
 * database to a 'failed' status, and formatting the HTTP error response.
 *
 * Rationale for Creation:
 * This utility was extracted from the main API route handler (app/api/generate/route.ts) to:
 * 1. Reduce code repetition: Similar error handling logic was scattered across multiple try/catch blocks.
 * 2. Improve readability: Simplify the main route's control flow by abstracting error handling details.
 * 3. Ensure consistency: Guarantee that all critical errors are processed in the same manner.
 * 4. Enhance maintainability: Changes to error reporting or job failure updates can be made in one place.
 *
 * Role:
 * - Receives an error object, the current OpenTelemetry span, job details (like jobId and dbPool),
 *   and configuration for the client-facing response.
 * - Logs the error with context.
 * - Records the exception on the OpenTelemetry span and sets its status to ERROR.
 * - Attempts to update the `generation_jobs` table in the database, marking the job as 'failed'
 *   and storing an error message (if a valid `jobId` is provided).
 * - Constructs and returns a standardized `NextResponse` object for the client.
 */
import { NextResponse } from 'next/server';
import type { Span } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import type { Pool, PoolClient } from 'pg';
import type { GenerationJobStatus } from './generation-job-tracker';

export interface HandleGenerationErrorParams {
  error: any;
  span: Span;
  jobId?: string;
  dbPool: Pool;
  responseDetails: {
    clientMessage: string;
    statusCode: number;
    dbErrorMessage?: string;
    errorDetails?: string;
    rawResponse?: string;
  };
  operationContext: string;
}

export async function handleGenerationError({
  error,
  span,
  jobId,
  dbPool,
  responseDetails,
  operationContext,
}: HandleGenerationErrorParams): Promise<NextResponse> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(
    `Error during ${operationContext}: ${errorMessage}`,
    errorStack ? `\nStack: ${errorStack}` : '',
    responseDetails.rawResponse
      ? `\nRaw Response: ${responseDetails.rawResponse}`
      : '',
  );

  span.recordException(
    error instanceof Error ? error : new Error(errorMessage),
  );
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: `Error during ${operationContext}: ${errorMessage.substring(0, 256)}`,
  });

  if (jobId && typeof jobId === 'string') {
    let dbClientForUpdate: PoolClient | null = null;
    try {
      dbClientForUpdate = await dbPool.connect();
      const dbErrorMsgToStore = (
        responseDetails.dbErrorMessage || errorMessage
      ).substring(0, 1000);
      const failedStatus: GenerationJobStatus = 'failed';
      await dbClientForUpdate.query(
        `UPDATE generation_jobs SET status = $1, error_msg = $2, updated_at = NOW()
         WHERE id = $3`,
        [failedStatus, dbErrorMsgToStore, jobId],
      );
      console.log(
        `Job ${jobId} status updated to '${failedStatus}' in DB due to error in ${operationContext}.`,
      );
    } catch (dbUpdateError) {
      const dbUpdateErrorMessage =
        dbUpdateError instanceof Error
          ? dbUpdateError.message
          : String(dbUpdateError);
      console.error(
        `CRITICAL: Failed to update job ${jobId} status to 'failed' in DB after error in ${operationContext}: ${dbUpdateErrorMessage}`,
      );
      span.recordException(
        dbUpdateError instanceof Error
          ? dbUpdateError
          : new Error(dbUpdateErrorMessage),
      );
      span.setAttribute('db.update.job.failed_status.error', true);
    } finally {
      dbClientForUpdate?.release();
    }
  } else if (jobId) {
    console.warn(
      `Invalid jobId ('${jobId}') or scenario to skip DB update for ${operationContext}, skipping DB update for job status.`,
    );
  } else {
    console.warn(
      `No jobId provided for ${operationContext}, skipping DB update for job status.`,
    );
  }

  const responseBody: {
    error: string;
    details?: string;
    rawResponse?: string;
  } = {
    error: responseDetails.clientMessage,
    details: responseDetails.errorDetails || errorMessage,
  };

  if (responseDetails.rawResponse) {
    responseBody.rawResponse = responseDetails.rawResponse;
  }

  return NextResponse.json(responseBody, {
    status: responseDetails.statusCode,
  });
}
