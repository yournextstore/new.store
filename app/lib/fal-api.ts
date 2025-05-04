import * as fal from '@fal-ai/serverless-client';

// Initialize Fal AI client (outside the function to reuse connection)
// Ensure FAL_KEY environment variable is set
if (!process.env.FAL_KEY) {
  console.warn(
    '[Fal AI] Warning: FAL_KEY environment variable is not set. Fal AI calls will fail.',
  );
}
fal.config({
  credentials: process.env.FAL_KEY ?? 'fal_key_not_set',
});

const FAL_API_TIMEOUT_MS = 15000; // 15 seconds timeout for Fal AI

/**
 * Calls the Fal AI Flux 1.1 Pro text-to-image API.
 *
 * @param prompt The text prompt for image generation.
 * @returns The generated image URL if successful, otherwise null.
 */
export async function callFalAiTextToImage(
  prompt: string,
): Promise<string | null> {
  if (!process.env.FAL_KEY) {
    console.error('[Fal AI] FAL_KEY not set. Cannot call API.');
    return null;
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    console.warn('[Fal AI] Received empty or invalid prompt.');
    return null;
  }

  console.log(
    `[Fal AI] Calling API for prompt: "${prompt.substring(0, 70)}..."`,
  );

  try {
    // Use a Promise with a timeout
    const resultPromise = fal.subscribe('fal-ai/flux-pro/v1.1', {
      input: {
        prompt: prompt,
        // Default size, can be parameterized later if needed
        width: 1024,
        height: 1024,
        // Add other parameters as needed, e.g., negative_prompt, num_inference_steps
      },
      logs: true, // Optional: include logs for debugging
      // disable queue update logging as its rather noisy
      //   onQueueUpdate(update) {
      //     console.log('[Fal AI] Queue update:', update);
      //   },
    });

    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(
        () => reject(new Error('Fal AI API call timed out')),
        FAL_API_TIMEOUT_MS,
      ),
    );

    // Race the API call against the timeout
    const result: any = await Promise.race([resultPromise, timeoutPromise]);

    // Check the result structure (adjust based on actual Fal AI response)
    // Assuming the result has an 'images' array with URLs
    const imageUrl = result?.images?.[0]?.url;

    if (typeof imageUrl === 'string' && imageUrl.length > 0) {
      console.log(`[Fal AI] Success: Received image URL.`);
      console.log(`[Fal AI] URL: ${imageUrl}`);
      return imageUrl;
    } else {
      console.error(
        '[Fal AI] Could not find image URL in response:',
        JSON.stringify(result),
      );
      return null;
    }
  } catch (error: any) {
    console.error('[Fal AI] Failed to call API:', error);
    if (error.message === 'Fal AI API call timed out') {
      console.error(`[Fal AI] Timeout after ${FAL_API_TIMEOUT_MS}ms.`);
    }
    return null;
  }
}
