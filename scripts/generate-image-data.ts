import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { embed, generateObject, EmbeddingModel } from 'ai';
import { z } from 'zod';
import cliProgress from 'cli-progress';
import Table from 'cli-table3';

// Load environment variables from .env file
dotenv.config();

// --- Constants ---
const IMAGE_LIBRARY_DIR = path.join(process.cwd(), 'public', 'images', 'library');
const OUTPUT_DATA_FILE = path.join(process.cwd(), 'data', 'lib', 'image-library.json');
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
const DESCRIPTION_MODEL = openai('gpt-4o');
const API_TIMEOUT_MS = 60000;
const MAX_RETRIES = 3;

// --- Zod Schema for Structured Output ---
const descriptionSchema = z.object({
  description: z.string().describe('Detailed description of the image focusing on visual elements, style, colors, and potential category.'),
  shortName: z.string().describe('A very short name (3-5 words) for the image, like a title.'),
});

// --- Types ---
interface ImageData {
  path: string; // Relative path from /public
  description: string;
  shortName: string;
  embedding: number[];
}

// --- Helper Functions ---

/**
 * Finds all image files within a directory.
 * @param dir Path to the directory.
 * @returns A promise that resolves to an array of image file paths.
 */
async function findImageFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Recursively search subdirectories if needed in the future
          // For now, we assume a flat structure based on PRD
          // return findImageFiles(fullPath);
          return []; // Ignore subdirectories for now
        } else if (
          entry.isFile() &&
          SUPPORTED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
        ) {
          return [fullPath];
        }
        return [];
      }),
    );
    return files.flat();
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

// --- Main Execution ---

async function main() {
  console.log('Starting image description, name, and embedding generation...');

  // 1. Ensure API Key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  // 2. Find image files
  console.log(`Scanning for images in: ${IMAGE_LIBRARY_DIR}`);
  const imagePaths = await findImageFiles(IMAGE_LIBRARY_DIR);
  if (imagePaths.length === 0) {
    console.log('No image files found. Exiting.');
    return;
  }
  console.log(`Found ${imagePaths.length} images to process.`);

  // 3. Ensure output directory exists
  await ensureDirectoryExists(OUTPUT_DATA_FILE);

  // 4. Set up Progress Bar
  console.log('Processing images...');
  const progressBar = new cliProgress.SingleBar(
    { format: ' {bar} | {percentage}% | ETA: {eta}s | {value}/{total} | File: {filename}' },
    cliProgress.Presets.shades_classic,
  );
  progressBar.start(imagePaths.length, 0, { filename: 'N/A' });

  // 5. Process Images
  const results: ImageData[] = [];
  const errors: { path: string; error: any }[] = [];

  for (const imagePath of imagePaths) {
    const relativePath = path.relative(path.join(process.cwd(), 'public'), imagePath);
    const filename = path.basename(imagePath);
    progressBar.update({ filename });

    try {
      // Read image file
      const imageBuffer = await fs.readFile(imagePath);

      // Generate structured description and shortName
      const { object: generatedData } = await generateObject({
        model: DESCRIPTION_MODEL,
        schema: descriptionSchema,
        messages: [
          { role: 'user', content: [{ type: 'image', image: imageBuffer }, { type: 'text', text: DESCRIPTION_PROMPT }] }
        ],
        maxRetries: MAX_RETRIES,
        abortSignal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      // Validate (redundant with generateObject success, but good practice)
      if (!generatedData || !generatedData.description || !generatedData.shortName) {
        throw new Error('Failed to generate complete structured data (description/shortName).');
      }

      // Generate embedding for the detailed description
      const { embedding } = await embed({
        model: EMBEDDING_MODEL,
        value: generatedData.description,
        maxRetries: MAX_RETRIES,
        abortSignal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      results.push({
        path: `/${relativePath}`,
        description: generatedData.description,
        shortName: generatedData.shortName,
        embedding,
      });
    } catch (error) {
      errors.push({ path: imagePath, error });
    }
    progressBar.increment();
  }

  progressBar.stop();

  // 6. Report errors
  if (errors.length > 0) {
    console.warn(`
\nEncountered errors processing ${errors.length} images:`);
    errors.forEach(err => {
        console.warn(`- ${path.basename(err.path)}: ${err.error?.message || 'Unknown error'}`);
    });
  }

  // --- Print Summary Table ---
  if (results.length > 0) {
    console.log('\n--- Generated Content Summary ---');
    const table = new Table({
      head: ['Filename', 'Short Name', 'Description'],
      colWidths: [30, 30, 70], // Adjust widths as needed
      wordWrap: true,
      style: { head: ['cyan'] } // Optional styling
    });

    results.forEach(result => {
      table.push([
        path.basename(result.path),
        result.shortName,
        result.description
      ]);
    });

    console.log(table.toString());
  }
  // --- End Summary Table ---

  // 7. Write results to JSON file
  if (results.length > 0) {
    try {
      const jsonData = JSON.stringify(results, null, 2);
      await fs.writeFile(OUTPUT_DATA_FILE, jsonData, 'utf-8');
      console.log(`
Successfully generated data for ${results.length} images.`);
      console.log(`Data saved to: ${OUTPUT_DATA_FILE}`);
    } catch (error) {
      console.error(`\nError writing data to ${OUTPUT_DATA_FILE}:`, error);
      process.exit(1);
    }
  } else {
      console.log('\nNo image data was successfully generated. Output file not written.')
  }
}

main().catch((error) => {
  console.error('\nScript failed:', error);
  process.exit(1);
}); 