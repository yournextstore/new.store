import { NextResponse } from 'next/server';

const GETIMG_API_KEY = process.env.GETIMG_API_KEY;
const GETIMG_ENDPOINT = 'https://api.getimg.ai/v1/flux-schnell/text-to-image';
const API_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Calls the getimg.ai text-to-image API with a given prompt.
 * Handles basic error checking and timeout.
 *
 * @param prompt The text prompt for image generation.
 * @returns The generated image URL if successful, otherwise null.
 */
export async function callGetImgApi(prompt: string): Promise<string | null> {
  if (!GETIMG_API_KEY) {
    console.error('GETIMG_API_KEY environment variable is not set.');
    // Return null instead of throwing an error to allow graceful fallback
    return null;
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    console.warn('callGetImgApi: Received empty or invalid prompt.');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    console.log(`[getimg.ai] Calling API for prompt: "${prompt}"`);
    const response = await fetch(GETIMG_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${GETIMG_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        width: 1024, // Consistent size as per PRD
        height: 1024,
        response_format: 'url', // Request URL directly
      }),
      signal: controller.signal, // Link fetch to the abort controller
    });

    clearTimeout(timeoutId); // Clear timeout if fetch completes in time

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (_) {
        /* ignore */
      }
      console.error(
        `[getimg.ai] API error: ${response.status} ${response.statusText}. Body: ${errorBody}`,
      );
      return null;
    }

    const data = await response.json();

    // Extract the image URL (adjust selectors based on actual API response structure if needed)
    const imageUrl = data?.imageUrl || data?.url || data?.images?.[0]?.url;

    if (typeof imageUrl === 'string' && imageUrl.length > 0) {
      console.log(
        `[getimg.ai] Success: Received image URL for prompt "${prompt}"`,
      );
      console.log(`[getimg.ai] URL: ${imageUrl}`);
      return imageUrl;
    } else {
      console.error(
        '[getimg.ai] Could not find image URL in response:',
        JSON.stringify(data),
      );
      return null;
    }
  } catch (error: any) {
    clearTimeout(timeoutId); // Clear timeout if fetch fails for other reasons
    if (error.name === 'AbortError') {
      console.error(
        `[getimg.ai] API call timed out after ${API_TIMEOUT_MS}ms for prompt: "${prompt}"`,
      );
    } else {
      console.error(`[getimg.ai] Failed to call API:`, error);
    }
    return null;
  }
}
