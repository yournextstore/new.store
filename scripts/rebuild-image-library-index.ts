import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { embed, generateObject } from 'ai';
import { z } from 'zod';
import cliProgress from 'cli-progress';
import Table from 'cli-table3';
import { put } from '@vercel/blob';
import pLimit from 'p-limit';
import pg, { Pool } from 'pg';
import type { PoolClient } from 'pg';

// Load environment variables from .env file
dotenv.config();

// --- Database Connection ---
// Ensure process.env.POSTGRES_URL is defined using a type assertion
// or handle the case where it might be undefined more gracefully if necessary.
if (!process.env.POSTGRES_URL) {
  console.error('Error: POSTGRES_URL environment variable is not set.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // Consider adding SSL configuration if required for Neon/production
  // ssl: { rejectUnauthorized: false }, // Example for simple SSL
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  client?.query('SELECT NOW()', (err, result) => {
    release();
    if (err) {
      return console.error('Error executing query', err.stack);
    }
    console.log('Successfully connected to PostgreSQL.');
  });
});

// --- Constants ---
const IMAGE_LIBRARY_DIR = path.join(
  process.cwd(),
  'public',
  'images',
  'library',
);
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUTPUT_DATA_FILE = path.join(
  process.cwd(),
  'data',
  'lib',
  'image-library.json',
);
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const DESCRIPTION_PROMPT = `
Analyze the provided image and generate two fields:
1.  **description**: A concise, objective description of the key visual elements, style, and potential product category. Focus on details that would help match this image to a product or store theme. Be specific about colors, themes, objects, etc.
2.  **shortName**: A very brief name (3-5 words) suitable for a label or title for this image.

Example Input Image: (A lavender sneaker)
Example Output:
{
  "description": "A minimalist low-top sneaker in soft lavender with a white sole and black eyelets, perfect for a subtle yet stylish look.",
  "shortName": "Lavender Low-Top Sneaker"
}
`;
const EMBEDDING_MODEL = openai.embedding('text-embedding-3-small');
const DESCRIPTION_MODEL = openai('gpt-4.1-mini');
const API_TIMEOUT_MS = 60000;
const MAX_RETRIES = 3;
const CONCURRENCY = 16;

// Check for Vercel Blob token and URL
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error(
    'Error: BLOB_READ_WRITE_TOKEN environment variable is not set.',
  );
  process.exit(1);
}
if (!process.env.BLOB_URL) {
  console.error('Error: BLOB_URL environment variable is not set.');
  process.exit(1);
}

// --- Zod Schema for Structured Output ---
const descriptionSchema = z.object({
  description: z
    .string()
    .describe(
      'Detailed description of the image focusing on visual elements, style, colors, and potential category.',
    ),
  shortName: z
    .string()
    .describe('A very short name (3-5 words) for the image, like a title.'),
});

// --- Types ---
// Old interface (commented out or removed)
// interface ImageData {
//   path: string; // Relative path from /public
//   url: string; // Public URL from Vercel Blob
//   description: string;
//   shortName: string;
//   embedding: number[];
//   hash: string; // SHA256 hash of the image file content
//   blobPathname: string; // Pathname used for Vercel Blob storage
// }

// New interface matching DB schema from PRD
interface DbImageData {
  id: string; // UUID
  blob_url: string; // TEXT NOT NULL
  description: string; // TEXT NOT NULL
  embedding: number[]; // VECTOR(1536) NOT NULL - represented as number[] in JS/TS
  hash: string; // TEXT NOT NULL
  filename: string | null; // TEXT, nullable
  shortName: string | null; // TEXT, nullable
  blob_pathname: string; // TEXT NOT NULL
  layout_hint: 'left' | 'right' | 'center' | null; // TEXT, nullable CHECK
  image_type: 'product' | 'hero' | null; // TEXT, nullable
  source: string; // TEXT NOT NULL ('static', 'getimg.ai', etc.)
  created_at: Date; // TIMESTAMP WITH TIME ZONE NOT NULL
  // Keep relative path from /public for mapping/comparison, but not in DB
  relativePath?: string;
}

// Interface for items specifically for reporting table
interface ReportingItem {
  relativePath: string;
  shortName: string | null;
  description: string;
  blob_url: string;
  hash: string;
  status: 'Added' | 'Updated' | 'Moved';
}

// --- Helper Functions ---

/**
 * Calculates the SHA256 hash of a buffer.
 * @param buffer The buffer to hash.
 * @returns The hex-encoded SHA256 hash.
 */
function calculateHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Finds all image files within a directory.
 * @param dir Path to the directory.
 * @returns A promise that resolves to an array of absolute image file paths.
 */
async function findImageFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let imageFiles: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subDirImages = await findImageFiles(fullPath);
        imageFiles = imageFiles.concat(subDirImages);
      } else if (
        entry.isFile() &&
        SUPPORTED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
      ) {
        imageFiles.push(fullPath); // Keep absolute paths for reading
      }
    }
    return imageFiles;
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
    throw error; // Re-throw to stop the script
  }
}

/**
 * Ensures the output directory exists.
 * @param filePath Path to the output file.
 */
async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dirname = path.dirname(filePath);
  try {
    await fs.access(dirname);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirname, { recursive: true });
      console.log(`Created output directory: ${dirname}`);
    } else {
      throw error;
    }
  }
}

/**
 * Processes a single image: reads, uploads to blob, generates description and embedding.
 * This is called ONLY for new or modified images.
 * @param imagePath Absolute path to the image file.
 * @param imageBuffer Buffer containing the image data.
 * @param currentHash SHA256 hash of the image content.
 * @param blobPathname The calculated Vercel Blob pathname.
 * @returns A promise resolving to the processed ImageData (excluding path).
 */
async function generateNewImageData(
  imagePath: string, // Keep for error context
  imageBuffer: Buffer,
  currentHash: string,
  blobPathname: string,
  filename: string, // Added filename
): Promise<
  Omit<
    DbImageData,
    | 'id'
    | 'created_at'
    | 'relativePath'
    | 'layout_hint'
    | 'source'
    | 'image_type'
  >
> {
  // --- Vercel Blob Upload ---
  const blob = await put(blobPathname, imageBuffer, {
    access: 'public',
    allowOverwrite: true, // Necessary for updates/moves
  });
  const blobUrl = blob.url;
  // --- End Vercel Blob Upload ---

  // Generate structured description and shortName
  const { object: generatedData } = await generateObject({
    model: DESCRIPTION_MODEL,
    schema: descriptionSchema,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: imageBuffer },
          { type: 'text', text: DESCRIPTION_PROMPT },
        ],
      },
    ],
    maxRetries: MAX_RETRIES,
    abortSignal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (
    !generatedData ||
    !generatedData.description ||
    !generatedData.shortName
  ) {
    throw new Error(
      'Failed to generate complete structured data (description/shortName).',
    );
  }

  // Generate embedding for the detailed description
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: generatedData.description,
    maxRetries: MAX_RETRIES,
    abortSignal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  return {
    blob_url: blobUrl,
    description: generatedData.description,
    shortName: generatedData.shortName,
    embedding,
    hash: currentHash,
    blob_pathname: blobPathname,
    filename: filename, // Include filename
    // layout_hint and source will be set during DB operation
  };
}

/**
 * Determines the image type based on filename and path conventions.
 * @param relativePath Relative path from the PUBLIC directory (e.g., images/library/...)
 * @param filename The base filename (e.g., image-hero-left.jpg)
 * @returns 'hero' or 'product'.
 */
function determineImageType(
  relativePath: string,
  filename: string,
): 'product' | 'hero' {
  // Check for hero pattern in filename first (case-insensitive)
  if (filename.match(/-hero-/i)) {
    return 'hero';
  }
  // Check for product path pattern (using POSIX separators assumed from relativePath)
  // Matches 'images/library/ANYTHING/products/REST_OF_PATH'
  const productPathRegex = /^images\/library\/[^/]+\/products\//;
  if (relativePath.match(productPathRegex)) {
    return 'product';
  }
  // Default to product if neither pattern matches
  return 'product';
}

// --- Main Execution ---

async function main() {
  console.log('Starting incremental image library processing...');

  // 1. Ensure API Keys are set
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  // 2. Load Existing Data (from Database)
  const oldImageDataMap = new Map<string, DbImageData>(); // Key: relativePath from /public
  const oldImageBlobPathnameMap = new Map<string, DbImageData>(); // Key: blob_pathname
  let dbClient: PoolClient | null = null; // Declare client variable

  try {
    console.log('Connecting to database to load existing image records...');
    dbClient = await pool.connect(); // Acquire client
    const result = await dbClient.query<DbImageData>(
      'SELECT * FROM images WHERE source = $1',
      ['static'],
    ); // Assuming a table named 'images' and filtering by source
    result.rows.forEach((row) => {
      // Reconstruct relative path from blob_pathname if needed, or assume it's stored/derivable
      // For simplicity, let's assume blob_pathname structure mirrors relative path under 'library/'
      // Example: blob_pathname 'library/category/image.jpg' -> relativePath 'images/library/category/image.jpg'
      const relativePath = row.blob_pathname.replace(
        /^library\//,
        'images/library/',
      );
      const dataWithRelativePath = { ...row, relativePath }; // Add relativePath for map key
      oldImageDataMap.set(relativePath, dataWithRelativePath);
      oldImageBlobPathnameMap.set(row.blob_pathname, dataWithRelativePath); // Map by blob_pathname as well
    });
    console.log(
      `Loaded ${oldImageDataMap.size} existing 'static' image records from database.`,
    );
  } catch (error: any) {
    console.error('Error loading data from database:', error);
    if (dbClient) {
      dbClient.release(); // Ensure client is released on error
    }
    process.exit(1);
  } finally {
    // Release client if it was acquired - moved release here
    // dbClient?.release(); // Keep client for main processing
  }

  // 3. Find current image files
  console.log(`Scanning for images in: ${IMAGE_LIBRARY_DIR}`);
  const currentImagePaths = await findImageFiles(IMAGE_LIBRARY_DIR); // Get all absolute paths first
  if (currentImagePaths.length === 0) {
    console.log(
      'No image files found in library directory. Saving empty index.',
    );
    await fs.writeFile(OUTPUT_DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
    return;
  }
  console.log(`Found ${currentImagePaths.length} images on disk.`);

  // 4. Set up Progress Bar
  console.log('Processing images...');
  const progressBar = new cliProgress.SingleBar(
    {
      format:
        ' {bar} | {percentage}% | ETA: {eta_formatted} | {value}/{total} | Status: {status} | File: {filename}',
      etaBuffer: 100, // Smoother ETA
    },
    cliProgress.Presets.shades_classic,
  );
  progressBar.start(currentImagePaths.length, 0, {
    filename: 'N/A',
    status: 'Starting...',
  });

  // 5. Process Images Concurrently
  const errors: { path: string; error: any; reason: string }[] = [];
  const stats = {
    processed: 0,
    reused: 0,
    moved: 0, // Content same, path changed (blob re-uploaded, DB updated)
    deleted: 0, // Added counter for deletions
    errors: 0,
  };
  const limit = pLimit(CONCURRENCY);
  const processedRelativePaths = new Set<string>(); // Track relative paths found on disk
  const changedItemsForReporting: ReportingItem[] = []; // Collect items for the summary table

  // Acquire a client for the duration of processing
  if (!dbClient) {
    // Should not happen if initial load succeeded, but as a safeguard
    console.error('Failed to acquire database client before processing.');
    process.exit(1);
  }

  const processingPromises = currentImagePaths.map((imagePath) =>
    limit(async () => {
      const relativeToPublic = path.relative(PUBLIC_DIR, imagePath);
      const filename = path.basename(imagePath);
      processedRelativePaths.add(relativeToPublic); // Track this path exists
      progressBar.update({ filename, status: 'Hashing...' });

      // Find existing data using relative path first
      const existingData = oldImageDataMap.get(relativeToPublic);

      try {
        const imageBuffer = await fs.readFile(imagePath);
        const currentHash = calculateHash(imageBuffer);
        const relativeToLibrary = path.relative(IMAGE_LIBRARY_DIR, imagePath);
        // Ensure POSIX paths for blob storage
        const expectedBlobPathname = path.posix.join(
          'library',
          relativeToLibrary,
        );
        const layoutHint = determineLayoutHint(filename); // Function to determine hint from filename
        const imageType = determineImageType(relativeToPublic, filename); // Determine image type

        if (existingData && existingData.hash === currentHash) {
          // Content is the same
          if (existingData.blob_pathname === expectedBlobPathname) {
            // Path and content are the same, reuse everything
            progressBar.update({ status: 'Reused (Unchanged)' });
            // No DB action needed
            stats.reused++;
          } else {
            // Content same, but path changed (moved/renamed)
            progressBar.update({ status: 'Re-uploading & DB Update (Moved)' });

            // 1. Re-upload blob to new path
            const blob = await put(expectedBlobPathname, imageBuffer, {
              access: 'public',
              allowOverwrite: true, // Overwrite if somehow exists
            });

            // 2. Update Database Record
            await dbClient.query(
              `UPDATE images
               SET blob_url = $1, blob_pathname = $2, filename = $3, layout_hint = $4, image_type = $5
               WHERE id = $6`, // Use ID to reliably update the correct record
              [
                blob.url,
                expectedBlobPathname,
                filename,
                layoutHint,
                imageType,
                existingData.id,
              ],
            );

            stats.moved++;
            changedItemsForReporting.push({
              // Add to reporting
              relativePath: relativeToPublic,
              shortName: existingData.shortName,
              description: existingData.description,
              blob_url: blob.url,
              hash: currentHash,
              status: 'Moved',
            });
          }
        } else {
          // New image or content modified
          progressBar.update({ status: 'Generating AI Data & DB Upsert...' });

          // Generate Description, ShortName, Embedding (includes Blob upload)
          const newData = await generateNewImageData(
            imagePath,
            imageBuffer,
            currentHash,
            expectedBlobPathname,
            filename, // Pass filename
          );

          // Use UPSERT (INSERT ... ON CONFLICT ... UPDATE) to handle both new and modified cases
          // We use blob_pathname as the conflict target, assuming it should be unique for static assets
          const upsertQuery = `
            INSERT INTO images (
              blob_url, description, embedding, hash, filename, shortName,
              blob_pathname, layout_hint, image_type, source, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
            )
            ON CONFLICT (blob_pathname) DO UPDATE SET
              blob_url = EXCLUDED.blob_url,
              description = EXCLUDED.description,
              embedding = EXCLUDED.embedding,
              hash = EXCLUDED.hash,
              filename = EXCLUDED.filename,
              shortName = EXCLUDED.shortName,
              layout_hint = EXCLUDED.layout_hint,
              image_type = EXCLUDED.image_type,
              source = EXCLUDED.source;
            -- RETURNING id; -- Optionally return id if needed later
          `;

          await dbClient.query(upsertQuery, [
            newData.blob_url,
            newData.description,
            `[${newData.embedding.join(',')}]`, // Format embedding array for pgvector
            newData.hash,
            newData.filename,
            newData.shortName,
            newData.blob_pathname,
            layoutHint,
            imageType,
            'static', // Source is 'static' for library builds
          ]);

          const status: 'Added' | 'Updated' = existingData
            ? 'Updated'
            : 'Added';
          stats.processed++;
          changedItemsForReporting.push({
            // Add to reporting
            relativePath: relativeToPublic,
            shortName: newData.shortName,
            description: newData.description,
            blob_url: newData.blob_url,
            hash: newData.hash,
            status: status,
          });
          if (existingData && status === 'Updated') {
            // If it was an update based on content change, remove the old blob_pathname entry
            // from the map to prevent it being marked as deleted later if the path also changed.
            oldImageBlobPathnameMap.delete(existingData.blob_pathname);
          }
        }
      } catch (error: any) {
        errors.push({
          path: imagePath,
          error,
          reason: existingData
            ? 'Error processing modified/moved image'
            : 'Error processing new image',
        });
        stats.errors++;
      } finally {
        progressBar.increment();
      }
    }),
  );

  await Promise.allSettled(processingPromises); // Wait for all concurrent tasks
  progressBar.stop();

  // 6. Identify and Handle Deletions in DB
  const deletedItemsForReporting: string[] = [];
  try {
    console.log('\nChecking for deleted images...');
    const pathsToDelete: string[] = [];
    oldImageBlobPathnameMap.forEach((imageData, blobPathname) => {
      // An image is deleted if its original blob_pathname wasn't processed
      // (meaning the file is gone from disk)
      const correspondingRelativePath = imageData.relativePath;
      if (
        !correspondingRelativePath ||
        !processedRelativePaths.has(correspondingRelativePath)
      ) {
        // Check if the blob_pathname exists in the newly processed items map to handle renames correctly
        let foundAfterRename = false;
        for (const item of changedItemsForReporting) {
          if (
            item.status === 'Moved' &&
            item.relativePath === correspondingRelativePath
          ) {
            // This was handled by the MOVE logic (UPDATE in DB), not a delete.
            foundAfterRename = true;
            break;
          }
        }
        // Also check if it was updated (content change, potentially same path)
        for (const item of changedItemsForReporting) {
          if (
            item.status === 'Updated' &&
            item.relativePath === correspondingRelativePath
          ) {
            // This was handled by the UPSERT logic (UPDATE in DB), not a delete.
            foundAfterRename = true;
            break;
          }
        }

        if (!foundAfterRename) {
          pathsToDelete.push(imageData.id); // Use ID for deletion
          deletedItemsForReporting.push(
            imageData.relativePath || imageData.blob_pathname,
          ); // Report path
        }
      }
    });

    if (pathsToDelete.length > 0) {
      console.log(`Deleting ${pathsToDelete.length} records from database...`);
      // Delete in batches if necessary, though for moderate numbers, one query might be fine
      const deleteQuery = 'DELETE FROM images WHERE id = ANY($1::uuid[])';
      await dbClient.query(deleteQuery, [pathsToDelete]);
      stats.deleted = pathsToDelete.length;
      console.log(`${stats.deleted} records deleted.`);
      // Note: This doesn't remove files from Vercel Blob storage.
    } else {
      console.log('No images detected as deleted.');
    }
  } catch (error) {
    console.error('Error during database deletion:', error);
    stats.errors += deletedItemsForReporting.length; // Count deletions as errors if deletion fails
  } finally {
    // Release the main processing client
    if (dbClient) {
      dbClient.release();
      console.log('Database client released.');
    }
  }

  // 7. Report Summary
  console.log('\n--- Processing Summary ---');
  console.log(`Total images found on disk: ${currentImagePaths.length}`);
  console.log(`  - Reused (unchanged):     ${stats.reused}`);
  // processed includes both Added and Updated (content change)
  const addedCount = changedItemsForReporting.filter(
    (item) => item.status === 'Added',
  ).length;
  const updatedContentCount = changedItemsForReporting.filter(
    (item) => item.status === 'Updated',
  ).length;
  console.log(`  - Added (new files):      ${addedCount}`);
  console.log(`  - Updated (content change): ${updatedContentCount}`);
  console.log(`  - Updated (moved/renamed): ${stats.moved}`);
  console.log(`  - Images deleted in DB:   ${stats.deleted}`);
  console.log(`  - Errors:                 ${stats.errors}`);
  console.log(`--------------------------`);
  const finalDbCountResult = await pool.query(
    "SELECT COUNT(*) FROM images WHERE source = 'static'",
  );
  console.log(
    `Total 'static' records in DB: ${finalDbCountResult.rows[0].count}`,
  );

  // 8. Report errors
  if (errors.length > 0) {
    console.warn(`\nEncountered errors processing ${errors.length} images:`);
    // Sort errors by filename for readability
    errors.sort((a, b) =>
      path.basename(a.path).localeCompare(path.basename(b.path)),
    );
    errors.forEach((err) => {
      console.warn(
        `- ${path.basename(err.path)}: ${err.reason} - ${err.error?.message || 'Unknown error'}`,
      );
      // Optional: Log full error stack for debugging
      // console.error(err.error);
    });
  }

  // --- Print Summary Table for Changed Items ---
  // Sort changed items for consistent table output
  changedItemsForReporting.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  );

  if (
    changedItemsForReporting.length > 0 &&
    changedItemsForReporting.length < 50
  ) {
    console.log('\n--- Added / Updated / Moved Content Summary ---');
    const table = new Table({
      head: [
        'Path (Relative)', // Changed Header
        'Short Name',
        'Description',
        'Blob URL',
        'Hash (start)',
        'Status',
      ],
      colWidths: [30, 25, 40, 35, 15, 10],
      wordWrap: true,
      style: { head: ['cyan'] },
    });

    changedItemsForReporting.forEach((result) => {
      table.push([
        result.relativePath,
        result.shortName ?? 'N/A', // Handle potential null
        result.description.substring(0, 100) +
          (result.description.length > 100 ? '...' : ''),
        result.blob_url,
        result.hash.substring(0, 8),
        result.status,
      ]);
    });
    console.log(table.toString());
  } else if (changedItemsForReporting.length >= 50) {
    console.log(
      `\nSkipping summary table for ${changedItemsForReporting.length} added/updated/moved items.`,
    );
  } else if (
    stats.processed === 0 &&
    stats.moved === 0 &&
    stats.errors === 0 &&
    stats.deleted === 0
  ) {
    console.log('\nNo changes detected in the image library.');
  }
  // --- End Summary Table ---

  // 9. Finalize and Exit
  await pool.end(); // Close the connection pool
  console.log('\nImage library processing finished.');

  if (stats.errors > 0) {
    console.error(`\nScript finished with ${stats.errors} errors.`);
    process.exit(1);
  }
}

// --- Helper function to determine layout hint ---
function determineLayoutHint(
  filename: string,
): 'left' | 'right' | 'center' | null {
  const lowerFilename = filename.toLowerCase();
  if (
    lowerFilename.endsWith('-left.jpg') ||
    lowerFilename.endsWith('-left.png') ||
    lowerFilename.endsWith('-left.webp')
  ) {
    return 'left';
  }
  if (
    lowerFilename.endsWith('-right.jpg') ||
    lowerFilename.endsWith('-right.png') ||
    lowerFilename.endsWith('-right.webp')
  ) {
    return 'right';
  }
  // Add center logic if needed, e.g., endsWith('-center.jpg')
  // if (lowerFilename.endsWith('-center.jpg') || lowerFilename.endsWith('-center.png')) {
  //     return 'center';
  // }
  return null; // Default if no convention matches
}

main().catch((error) => {
  console.error('\nScript failed unexpectedly:', error);
  pool.end(); // Ensure pool is closed on unexpected error
  process.exit(1);
});
