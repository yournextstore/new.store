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

// Load environment variables from .env file
dotenv.config();

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
interface ImageData {
  path: string; // Relative path from /public
  url: string; // Public URL from Vercel Blob
  description: string;
  shortName: string;
  embedding: number[];
  hash: string; // SHA256 hash of the image file content
  blobPathname: string; // Pathname used for Vercel Blob storage
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
): Promise<Omit<ImageData, 'path'>> {
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
    url: blobUrl,
    description: generatedData.description,
    shortName: generatedData.shortName,
    embedding,
    hash: currentHash,
    blobPathname: blobPathname,
  };
}

// --- Main Execution ---

async function main() {
  console.log('Starting incremental image library processing...');

  // 1. Ensure API Keys are set
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  // 2. Load Existing Data (if available)
  const oldImageDataMap = new Map<string, ImageData>();
  try {
    const existingDataJson = await fs.readFile(OUTPUT_DATA_FILE, 'utf-8');
    const existingDataArray = JSON.parse(existingDataJson) as ImageData[];
    existingDataArray.forEach((data) => {
      // Use the relative path from /public as the key
      const relativePathKey = data.path.startsWith('/')
        ? data.path.substring(1)
        : data.path;
      oldImageDataMap.set(relativePathKey, data);
    });
    console.log(`Loaded ${oldImageDataMap.size} existing image records.`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('No existing image library data found. Starting fresh.');
      await ensureDirectoryExists(OUTPUT_DATA_FILE); // Ensure dir exists even if file doesn't
    } else {
      console.error(
        `Error reading existing data file ${OUTPUT_DATA_FILE}:`,
        error,
      );
      process.exit(1);
    }
  }

  // 3. Find current image files
  console.log(`Scanning for images in: ${IMAGE_LIBRARY_DIR}`);
  const currentImagePaths = await findImageFiles(IMAGE_LIBRARY_DIR); // Absolute paths
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
  const newImageDataMap = new Map<string, ImageData>();
  const errors: { path: string; error: any; reason: string }[] = [];
  const stats = {
    processed: 0,
    reused: 0,
    moved: 0, // Content same, path changed (blob re-uploaded)
    errors: 0,
  };
  const limit = pLimit(CONCURRENCY);
  const processedRelativePaths = new Set<string>(); // Track paths found on disk

  const processingPromises = currentImagePaths.map((imagePath) =>
    limit(async () => {
      const relativeToPublic = path.relative(PUBLIC_DIR, imagePath);
      const filename = path.basename(imagePath);
      processedRelativePaths.add(relativeToPublic); // Track this path exists
      progressBar.update({ filename, status: 'Hashing...' });

      const existingData = oldImageDataMap.get(relativeToPublic);

      try {
        const imageBuffer = await fs.readFile(imagePath);
        const currentHash = calculateHash(imageBuffer);
        const relativeToLibrary = path.relative(IMAGE_LIBRARY_DIR, imagePath);
        const expectedBlobPathname = path.posix.join(
          'library',
          relativeToLibrary,
        );

        let finalImageData: ImageData;

        if (existingData && existingData.hash === currentHash) {
          // Content is the same
          if (existingData.blobPathname === expectedBlobPathname) {
            // Path is also the same, reuse everything
            progressBar.update({ status: 'Reused (Unchanged)' });
            finalImageData = existingData;
            stats.reused++;
          } else {
            // Content same, but path changed (moved/renamed)
            // Reuse AI data, but re-upload blob to new path
            progressBar.update({ status: 'Re-uploading (Moved)' });
            const blob = await put(expectedBlobPathname, imageBuffer, {
              access: 'public',
              allowOverwrite: true,
            });
            finalImageData = {
              ...existingData, // Reuse description, shortName, embedding, hash
              path: `/${relativeToPublic}`, // Update relative path from /public
              url: blob.url, // Update blob URL
              blobPathname: expectedBlobPathname, // Update blob pathname
            };
            stats.moved++;
          }
        } else {
          // New image or content modified
          progressBar.update({ status: 'Generating AI Data...' });
          const newData = await generateNewImageData(
            imagePath,
            imageBuffer,
            currentHash,
            expectedBlobPathname,
          );
          finalImageData = {
            path: `/${relativeToPublic}`, // Relative path from /public
            ...newData,
          };
          stats.processed++;
        }

        newImageDataMap.set(relativeToPublic, finalImageData);
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

  // 6. Identify and Handle Deletions
  const deletedPaths: string[] = [];
  oldImageDataMap.forEach((_, relativePathKey) => {
    if (!processedRelativePaths.has(relativePathKey)) {
      deletedPaths.push(relativePathKey);
      // No need to remove from Vercel Blob for this script
    }
  });
  if (deletedPaths.length > 0) {
    console.log(
      `\nDetected ${deletedPaths.length} images removed from the library directory.`,
    );
    // These are implicitly removed as they are not added to newImageDataMap
  }
  stats.errors += errors.length; // Update total errors

  // 7. Report Summary
  console.log('\n--- Processing Summary ---');
  console.log(`Total images found on disk: ${currentImagePaths.length}`);
  console.log(`  - Reused (unchanged):     ${stats.reused}`);
  console.log(`  - Updated (moved/renamed): ${stats.moved}`);
  console.log(`  - Newly processed:        ${stats.processed}`);
  console.log(`  - Images deleted:         ${deletedPaths.length}`);
  console.log(`  - Errors:                 ${stats.errors}`);
  console.log(`--------------------------`);
  console.log(`Total records in new index: ${newImageDataMap.size}`);

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

  // Convert Map to Array for saving
  const finalResultsArray = Array.from(newImageDataMap.values());
  // Sort final array by path for consistent output
  finalResultsArray.sort((a, b) => a.path.localeCompare(b.path));

  // --- Print Summary Table (Optional - can be large) ---
  if (finalResultsArray.length > 0 && finalResultsArray.length < 50) {
    // Limit table size
    console.log('\n--- Generated Content Summary (Sample) ---');
    const table = new Table({
      head: ['Path', 'Short Name', 'Description', 'Blob URL', 'Hash (start)'],
      colWidths: [30, 25, 40, 35, 15],
      wordWrap: true,
      style: { head: ['cyan'] },
    });

    finalResultsArray.forEach((result) => {
      table.push([
        result.path,
        result.shortName,
        result.description.substring(0, 100) +
          (result.description.length > 100 ? '...' : ''), // Truncate desc
        result.url,
        result.hash.substring(0, 8), // Show start of hash
      ]);
    });
    console.log(table.toString());
  } else if (finalResultsArray.length >= 50) {
    console.log('\nSkipping summary table due to large number of images.');
  }
  // --- End Summary Table ---

  // 9. Write results to JSON file
  if (
    finalResultsArray.length > 0 ||
    deletedPaths.length > 0 ||
    oldImageDataMap.size === 0
  ) {
    // Write even if empty now, to record deletions
    try {
      const jsonData = JSON.stringify(finalResultsArray, null, 2);
      await fs.writeFile(OUTPUT_DATA_FILE, jsonData, 'utf-8');
      console.log(`
Successfully updated image library index.`);
      console.log(`Data saved to: ${OUTPUT_DATA_FILE}`);
    } catch (error) {
      console.error(`\nError writing data to ${OUTPUT_DATA_FILE}:`, error);
      process.exit(1); // Exit if final save fails
    }
  } else if (stats.errors === 0) {
    console.log(
      '\nNo changes detected and no errors. Output file remains unchanged.',
    );
  } else {
    console.log('\nNo data generated due to errors. Output file not written.');
  }

  if (stats.errors > 0) {
    console.error(`\nScript finished with ${stats.errors} errors.`);
    process.exit(1); // Exit with error code if any errors occurred
  }
}

main().catch((error) => {
  console.error('\nScript failed unexpectedly:', error);
  process.exit(1);
});
