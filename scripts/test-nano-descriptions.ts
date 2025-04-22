import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import cliProgress from 'cli-progress';
import Table from 'cli-table3';
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
const EXISTING_DATA_FILE = path.join(
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
const NANO_MODEL_ID = 'gpt-4.1-nano'; // Model to test
const MINI_MODEL_ID = 'gpt-4.1-mini'; // Additional model to test
const EXISTING_MODEL_ID = 'gpt-4o'; // Current model in use
const API_TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 3;
const CONCURRENCY = 4; // Lower concurrency for testing
const SAMPLE_SIZE = 20; // Number of images to test

// Check for API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is not set.');
  process.exit(1);
}

// --- Zod Schema ---
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
interface ExistingImageData {
  path: string; // Relative path from /public
  url: string;
  description: string;
  shortName: string;
  embedding: number[];
}

interface ComparisonResult {
  filename: string;
  existingShortName: string;
  newShortName: string;
  miniShortName: string;
  existingDescription: string;
  newDescription: string;
  miniDescription: string;
}

// --- Helper Functions ---

/**
 * Finds all image files within a directory.
 */
async function findImageFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let imageFiles: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subDirImages = await findImageFiles(fullPath);
        imageFiles = imageFiles.concat(subDirImages);
      } else if (
        entry.isFile() &&
        SUPPORTED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
      ) {
        imageFiles.push(fullPath);
      }
    }
    return imageFiles;
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
    throw error;
  }
}

/**
 * Selects a random sample from an array.
 */
function getRandomSample<T>(arr: T[], size: number): T[] {
  // Ensure the array is not sparse and contains valid items
  const validArr = arr.filter((item) => item !== undefined && item !== null);

  // Simple shuffle using sort with random comparison
  const shuffled = validArr.sort(() => 0.5 - Math.random());

  // Get the first 'size' elements, ensuring size doesn't exceed array length
  const actualSize = Math.min(size, shuffled.length);
  return shuffled.slice(0, actualSize);
}

/**
 * Processes a single image using the specified model.
 * Renamed from generateNanoDescription for broader use.
 */
async function generateDescription(
  imagePath: string,
  model: any, // Adjust type based on actual AI SDK export if known
): Promise<z.infer<typeof descriptionSchema>> {
  const imageBuffer = await fs.readFile(imagePath);

  const { object: generatedData } = await generateObject({
    model: model,
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
  return generatedData;
}

// --- Main Execution ---

async function main() {
  console.log(
    `Starting comparison of ${EXISTING_MODEL_ID} vs ${NANO_MODEL_ID} vs ${MINI_MODEL_ID} for image descriptions...`,
  );

  // 1. Load Existing Data
  console.log(`Loading existing data from: ${EXISTING_DATA_FILE}`);
  let existingData: ExistingImageData[] = [];
  try {
    const rawData = await fs.readFile(EXISTING_DATA_FILE, 'utf-8');
    existingData = JSON.parse(rawData);
  } catch (error) {
    console.error(
      `Error reading or parsing existing data file ${EXISTING_DATA_FILE}:`,
      error,
    );
    process.exit(1);
  }
  const existingDataMap = new Map<string, ExistingImageData>(
    existingData.map((item) => [item.path, item]),
  );
  console.log(`Loaded ${existingDataMap.size} existing image records.`);

  // 2. Find image files
  console.log(`Scanning for images in: ${IMAGE_LIBRARY_DIR}`);
  const allImagePaths = await findImageFiles(IMAGE_LIBRARY_DIR);
  if (allImagePaths.length === 0) {
    console.log('No image files found in library directory. Exiting.');
    return;
  }
  console.log(`Found ${allImagePaths.length} total images.`);

  // 3. Select Sample
  const samplePaths = getRandomSample(
    allImagePaths,
    Math.min(SAMPLE_SIZE, allImagePaths.length),
  );
  console.log(`Selected random sample of ${samplePaths.length} images.`);

  // 4. Initialize Models
  const nanoModel = openai(NANO_MODEL_ID);
  const miniModel = openai(MINI_MODEL_ID);

  // 5. Set up Progress Bar
  console.log('Processing image samples...');
  const progressBar = new cliProgress.SingleBar(
    {
      format:
        ' {bar} | {percentage}% | ETA: {eta}s | {value}/{total} | File: {filename}',
    },
    cliProgress.Presets.shades_classic,
  );
  progressBar.start(samplePaths.length, 0, { filename: 'N/A' });

  // 6. Process Images Concurrently
  const comparisonResults: ComparisonResult[] = [];
  const errors: { path: string; error: any }[] = [];
  const limit = pLimit(CONCURRENCY);

  const processingPromises = samplePaths.map((imagePath) => {
    const filename = path.basename(imagePath);
    return limit(async () => {
      progressBar.update({ filename });
      try {
        // Generate descriptions from both models
        const [nanoResult, miniResult] = await Promise.all([
          generateDescription(imagePath, nanoModel),
          generateDescription(imagePath, miniModel),
        ]);

        // Use template literal for path construction
        const relativePath = `/${path.relative(
          path.join(process.cwd(), 'public'),
          imagePath,
        )}`;
        const existing = existingDataMap.get(relativePath);

        if (!existing) {
          console.warn(
            `
Warning: No existing data found for ${relativePath}. Skipping comparison for this image.`,
          );
          return; // Skip if no existing data to compare against
        }

        comparisonResults.push({
          filename: filename,
          existingShortName: existing.shortName,
          newShortName: nanoResult.shortName,
          miniShortName: miniResult.shortName,
          existingDescription: existing.description,
          newDescription: nanoResult.description,
          miniDescription: miniResult.description,
        });
      } catch (error) {
        errors.push({ path: imagePath, error: error });
      } finally {
        progressBar.increment();
      }
    });
  });

  await Promise.all(processingPromises);
  progressBar.stop();

  // 7. Report errors
  if (errors.length > 0) {
    console.warn(`

Encountered errors processing ${errors.length} images:`);
    errors.forEach((err) => {
      console.warn(
        `- ${path.basename(err.path)}: ${err.error?.message || 'Unknown error'}`,
      );
    });
  }

  // 8. Display Comparison Table
  if (comparisonResults.length > 0) {
    console.log('\n--- Description Comparison ---');
    const table = new Table({
      head: [
        'Filename',
        `Short Name (${EXISTING_MODEL_ID})`,
        `Short Name (${NANO_MODEL_ID})`,
        `Short Name (${MINI_MODEL_ID})`,
        `Description (${EXISTING_MODEL_ID})`,
        `Description (${NANO_MODEL_ID})`,
        `Description (${MINI_MODEL_ID})`,
      ],
      colWidths: [25, 18, 18, 18, 35, 35, 35],
      wordWrap: true,
      style: { head: ['cyan'] },
    });

    // Sort results alphabetically by filename for consistency
    comparisonResults.sort((a, b) => a.filename.localeCompare(b.filename));

    comparisonResults.forEach((result) => {
      table.push([
        result.filename,
        result.existingShortName,
        result.newShortName,
        result.miniShortName,
        result.existingDescription,
        result.newDescription,
        result.miniDescription,
      ]);
    });

    console.log(table.toString());
    console.log(
      `\nComparison complete for ${comparisonResults.length} images. Please review the table above.`,
    );
  } else {
    console.log('\nNo comparison results generated (check for errors).');
  }
}

main().catch((error) => {
  console.error('\nScript failed:', error);
  process.exit(1);
});
