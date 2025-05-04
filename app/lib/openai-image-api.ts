// Using the official OpenAI library as per research note
import OpenAI from 'openai';
import { put } from '@vercel/blob'; // Import Vercel Blob client
import { nanoid } from 'nanoid'; // Import nanoid for unique filenames
import { calculateHash } from './utils';

// Initialize OpenAI client
// Ensure OPENAI_API_KEY environment variable is set
if (!process.env.OPENAI_API_KEY) {
  console.warn(
    '[OpenAI Image] Warning: OPENAI_API_KEY environment variable is not set. OpenAI calls will fail.',
  );
}
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? 'openai_key_not_set',
});

const OPENAI_API_TIMEOUT_MS = 40000; // 40 seconds timeout for OpenAI Images API

/**
 * Calls the OpenAI Images API (gpt-image-1 model).
 * Generates an image, uploads it to Vercel Blob, calculates its hash,
 * and returns the Blob URL and hash.
 *
 * @param prompt The text prompt for image generation.
 * @returns An object containing the Vercel Blob URL and the image hash if successful, otherwise null.
 */
export async function callOpenAiTextToImage(
  prompt: string,
): Promise<{ blobUrl: string; hash: string } | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[OpenAI Image] OPENAI_API_KEY not set. Cannot call API.');
    return null;
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    console.warn('[OpenAI Image] Received empty or invalid prompt.');
    return null;
  }

  console.log(
    `[OpenAI Image] Calling API for prompt: "${prompt.substring(0, 70)}..."`,
  );

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      OPENAI_API_TIMEOUT_MS,
    );

    const response = await openai.images.generate(
      {
        model: 'gpt-image-1',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        output_format: 'png',
        quality: 'medium',
      },
      { signal: controller.signal }, // Pass the abort signal
    );

    clearTimeout(timeoutId); // Clear timeout if request succeeded

    // Extract the original base64 image data FIRST
    const b64ImageData = response.data?.[0]?.b64_json;

    // Log the response structure, safely truncating the b64_json string
    try {
      // Perform a deep copy for logging to avoid mutating the original response
      const responseForLogging = structuredClone(response);
      if (responseForLogging.data?.[0]?.b64_json) {
        const originalLength = responseForLogging.data[0].b64_json.length;
        // Replace the long string in the *copy* with a truncated version
        responseForLogging.data[0].b64_json = `${responseForLogging.data[0].b64_json.substring(0, 50)}... (length: ${originalLength})`;
      }
      console.log(
        '[OpenAI Image] Full API Response (b64 truncated):',
        JSON.stringify(responseForLogging, null, 2),
      );
    } catch (logError) {
      console.error(
        '[OpenAI Image] Error formatting response for logging:',
        logError,
      );
      // Fallback: Log the raw response object if stringify fails on the modified one
      console.log('[OpenAI Image] Raw API Response Object:', response);
    }

    // Now, process the original, unmutated b64ImageData
    if (typeof b64ImageData === 'string' && b64ImageData.length > 0) {
      console.log('[OpenAI Image] Processing original b64_json data.');
      // Log start and length of the ORIGINAL Base64 string
      console.log(
        `[OpenAI Image] Original b64_json length: ${b64ImageData.length}`,
      );

      const imageBuffer = Buffer.from(b64ImageData, 'base64');

      // Log the size of the buffer before uploading
      console.log(
        `[OpenAI Image] Decoded buffer size: ${imageBuffer.byteLength} bytes`,
      );

      // Calculate hash before upload
      const imageHash = calculateHash(imageBuffer);
      console.log(`[OpenAI Image] Calculated hash: ${imageHash}`);

      // Generate unique filename and path for Vercel Blob
      // Assuming PNG format, adjust if API specifies otherwise
      const filename = `openai-${nanoid()}.png`;
      const blobPathname = `generated/${filename}`;

      // Upload to Vercel Blob
      console.log(`[OpenAI Image] Uploading image to: ${blobPathname}...`);
      const blobResult = await put(blobPathname, imageBuffer, {
        access: 'public',
        contentType: 'image/png', // Specify content type
      });
      console.log(
        `[OpenAI Image] Upload successful. Blob URL: ${blobResult.url}`,
      );

      // Return the Vercel Blob URL *and* the hash
      return { blobUrl: blobResult.url, hash: imageHash };
    } else {
      console.error(
        '[OpenAI Image] Could not find b64_json data in response:',
        JSON.stringify(response),
      );
      return null;
    }
  } catch (error: any) {
    // Handle potential timeout
    if (error.name === 'AbortError') {
      console.error(
        `[OpenAI Image] API call timed out after ${OPENAI_API_TIMEOUT_MS}ms.`,
      );
      return null;
    }

    // Handle other API errors (e.g., invalid key, rate limits, content policy)
    console.error(
      '[OpenAI Image] Failed to call API or upload to blob:',
      error,
    );
    // Log specific OpenAI API error details if available
    if (error instanceof OpenAI.APIError) {
      console.error(`[OpenAI Image] Status: ${error.status}`);
      console.error(`[OpenAI Image] Message: ${error.message}`);
      console.error(`[OpenAI Image] Code: ${error.code}`);
      console.error(`[OpenAI Image] Type: ${error.type}`);
    }
    return null;
  }
}
