import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai'; // General type for language models

/**
 * Defines the structure for dynamic Helicone headers that can be passed
 * when creating a model provider instance.
 *
 * Future potential dynamic headers to consider:
 * - 'Helicone-User-Id': For tracking requests against specific users.
 * - 'Helicone-Session-Id': For grouping requests within a user session.
 * - 'Helicone-Trace-Id': For correlating with other observability systems.
 * - 'Helicone-Prompt-Id': If you have a system for versioning or identifying specific prompts.
 * - 'Helicone-Property-{CustomKey}': For any custom metadata you want to associate with the request.
 */
interface DynamicHeliconeHeaders {
  [key: string]: string | undefined;
}

/**
 * Constructs the common set of Helicone headers, merging static defaults
 * with any dynamically provided headers.
 * @param dynamicHeaders Optional object containing headers to merge.
 * @returns A HeadersInit object for Helicone.
 */
const getHeliconeBaseHeaders = (
  dynamicHeaders?: DynamicHeliconeHeaders,
): Record<string, string> => {
  const headers: Record<string, string> = {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    // 'Helicone-Cache-Enabled': 'false', // Explicitly set to false, per user request.
    // Consider making this configurable if caching is desired later.
    // TODO: Consider adding other default Helicone properties here,
    // e.g., 'Helicone-Property-Environment': process.env.NODE_ENV
  };

  if (dynamicHeaders) {
    for (const key in dynamicHeaders) {
      if (dynamicHeaders[key] !== undefined) {
        headers[key] = dynamicHeaders[key] as string;
      }
    }
  }
  return headers;
};

// Infer the return type from the createOpenAI function itself
// This makes it more robust to SDK changes.
type OpenAIProvider = ReturnType<typeof createOpenAI>;

/**
 * Creates an OpenAI provider instance configured to use Helicone.
 *
 * @param dynamicHeaders Optional dynamic headers to include for this specific instance.
 *                       These will be merged with default Helicone headers.
 *                       Consider passing 'Helicone-User-Id', 'Helicone-Session-Id', etc.
 * @returns An OpenAI provider instance, typed by inference.
 */
export const heliconeOpenAI = (
  dynamicHeaders?: DynamicHeliconeHeaders,
): OpenAIProvider => {
  if (!process.env.HELICONE_API_KEY) {
    console.warn(
      '[AI Providers] HELICONE_API_KEY is not set. Helicone logging for OpenAI will likely fail.',
    );
  }
  const heliconeHeaders = getHeliconeBaseHeaders(dynamicHeaders);
  return createOpenAI({
    baseURL: 'https://oai.helicone.ai/v1',
    headers: heliconeHeaders,
  });
};

// Infer the return type from the createGoogleGenerativeAI function
type GoogleProvider = ReturnType<typeof createGoogleGenerativeAI>;

/**
 * Creates a Google Generative AI provider instance configured to use Helicone.
 *
 * @param dynamicHeaders Optional dynamic headers to include for this specific instance.
 *                       These will be merged with default Helicone headers.
 *                       Consider passing 'Helicone-User-Id', 'Helicone-Session-Id', etc.
 * @returns A GoogleGenerativeAI provider instance, typed by inference.
 */
export const heliconeGoogle = (
  dynamicHeaders?: DynamicHeliconeHeaders,
): GoogleProvider => {
  if (!process.env.HELICONE_API_KEY) {
    console.warn(
      '[AI Providers] HELICONE_API_KEY is not set. Helicone logging for Google will likely fail.',
    );
  }
  if (!process.env.GOOGLE_API_KEY) {
    console.warn(
      '[AI Providers] GOOGLE_API_KEY is not set. Google API calls will likely fail.',
    );
  }
  return createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    baseURL: 'https://gateway.helicone.ai/v1beta',
    headers: {
      ...getHeliconeBaseHeaders(dynamicHeaders),
      'Helicone-Target-URL': 'https://generativelanguage.googleapis.com',
    },
  });
};

// Example of how to potentially add a provider for a different service (e.g., Anthropic)
// export const heliconeAnthropic = (dynamicHeaders?: DynamicHeliconeHeaders): Anthropic => {
//   if (!process.env.HELICONE_API_KEY) {
//     console.warn('[AI Providers] HELICONE_API_KEY not set for Anthropic.');
//   }
//   if (!process.env.ANTHROPIC_API_KEY) {
//     console.warn('[AI Providers] ANTHROPIC_API_KEY not set.');
//   }
//   return createAnthropic({
//     apiKey: process.env.ANTHROPIC_API_KEY,
//     baseURL: 'https://anthropic.helicone.ai/v1', // Replace with actual Helicone URL for Anthropic
//     headers: {
//       ...getHeliconeBaseHeaders(dynamicHeaders),
//       'Helicone-Target-URL': 'https://api.anthropic.com', // Replace with actual Anthropic target
//     }
//   });
// };
