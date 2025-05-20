import { NextResponse } from 'next/server';
import { generateText, type LanguageModel } from 'ai';
import { heliconeOpenAI, heliconeGoogle } from '../../lib/ai-providers';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api'; // Span used as type
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import type { PoolClient } from 'pg'; // Import PoolClient for typing
import type { GenerationMode } from '../../lib/image-generation';
import { applyTheme } from '../../lib/theme';
import { replaceImagePlaceholders } from '../../lib/image';
import { pool } from '@/lib/db'; // Using @ alias for path
import { auth } from '@/lib/auth'; // For getting user session
import { headers } from 'next/headers'; // For getting headers for session
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';

const tracer = trace.getTracer('ai-generate-route-tracer');

/**
 * Injects a default theme (global and section-specific colors) into the AI-generated JSON.
 * @param json The AI-generated JSON data.
 * @returns The JSON data with the default theme injected.
 */

/**
 * Recursively traverses a JSON object/array and replaces image placeholder URLs
 * (matching `https://yns.img?description=...`) with URLs found via DB similarity search or generation.
 * Handles different image types (product, hero) and alignment requirements.
 * @param json The JSON data (or sub-part) to process.
 * @param imageMode Determines the source for PRODUCT images ('stock' or a generation API identifier).
 * @param imageStyle The image style (general style for product images consistent with the store concept).
 * @returns The modified JSON data.
 */

/*
  OpenTelemetry Tracing Strategy (Current Implementation):
  We are using the `tracer.startSpan()` pattern for creating spans, followed by
  a `try/catch/finally` block to manage the span's lifecycle (`span.end()`)
  and error reporting (`span.recordException()`, `span.setStatus()`).
  This approach is chosen for minimal code changes and to keep the original
  function structure more intact.

  Alternative Pattern: `tracer.startActiveSpan('span-name', async (span) => { ... })`
    - This pattern automatically manages setting the created span as "active" in the
      current asynchronous context, which is robust for ensuring child spans
      (even in other modules) correctly parent to this span. However, it introduces
      an additional callback layer, leading to more nested code.

  Chosen Pattern Rationale (`tracer.startSpan()`):
    - Relies on the existing active context (e.g., one set by Vercel for
      the serverless function invocation) for child spans to correctly parent themselves.
      For typical Vercel deployments, an active context is usually present, and
      Node.js async_hooks help with context propagation.
    - If issues with parent-child span relationships arise during testing,
      we may need to revisit this and either use `tracer.startActiveSpan()`
      or manually manage context with `context.with(trace.setSpan(context.active(), span), () => { ... })`
      for specific operations.

  Current Scope & Future Work:
  - Currently, tracing is applied to the four major external service calls/
    logical blocks: AI text generation, image processing orchestration,
    YNS API call, and database save.
  - Future enhancements could include more granular spans within these blocks
    (e.g., individual image generation steps inside `replaceImagePlaceholders`),
    spans for JSON parsing, theme application, etc., to provide deeper insights.
*/

// Helper function to extract Hero Image URL
function extractHeroImageUrl(json: any): string | null {
  try {
    const homepageSections = json?.paths?.['/'];
    if (Array.isArray(homepageSections)) {
      const heroSection = homepageSections.find(
        (section: any) => section.id === 'HeroSection',
      );
      if (
        heroSection?.data?.image?.src &&
        typeof heroSection.data.image.src === 'string'
      ) {
        return heroSection.data.image.src;
      } else {
        console.warn(
          'HeroSection found, but image.src is missing, not a string, or path is invalid:',
          heroSection?.data,
        );
        return null; // Hero image path not as expected
      }
    }
    console.warn(
      "Homepage sections ('paths./') not found or not an array in JSON.",
    );
    return null; // Homepage sections not found
  } catch (error) {
    console.error('Error extracting hero image URL:', error);
    return null;
  }
}

export async function POST(req: Request) {
  let llmTextGenerationTimeMs: number | null = null;
  let imageReplacementTimeMs: number | null = null;
  let ynsApiCallTimeMs: number | null = null;
  let databaseSaveTimeMs: number | string = 'Skipped';

  // --- Model Selection ---
  // Available models: 'gpt-4.1', 'gemini-2.5-flash'
  type ModelProvider = 'openai' | 'google';
  type ModelName = 'gpt-4.1' | 'gemini-2.5-flash';

  interface ModelConfig {
    provider: ModelProvider;
    modelName: string;
  }

  const SELECTED_MODEL: ModelName = 'gpt-4.1';
  const MODEL_CONFIGS: Record<ModelName, ModelConfig> = {
    'gpt-4.1': {
      provider: 'openai',
      modelName: 'gpt-4.1',
    },
    'gemini-2.5-flash': {
      provider: 'google',
      modelName: 'gemini-2.5-flash-preview-04-17',
    },
  };
  // --- End Model Selection ---

  const rootSpan: Span = tracer.startSpan('generate-store-request');
  try {
    // main prompt that generates the complete store JSON representation
    const prototypePrompt = await fs.readFile(
      path.join(process.cwd(), 'app/api/generate/gen-store-json-prompt.md'),
      'utf-8',
    );

    const body = await req.json();
    const userPrompt = body.prompt;

    console.log('userPrompt', userPrompt);

    const userId = body.userId;

    // --- Get User Email from Session ---
    let userEmail: string | null = null;
    try {
      const requestHeaders = await headers(); // Await the headers
      const session = await auth.api.getSession({ headers: requestHeaders });
      if (session?.user?.email) {
        userEmail = session.user.email;
        console.log(
          `Retrieved email ${userEmail} for user ${userId} from session.`,
        );
      } else {
        console.warn(
          `Could not retrieve email from session for user ${userId}. Email will be null in generated_stores.`,
        );
      }
    } catch (sessionError: any) {
      console.error(
        `Error retrieving session for user ${userId}:`,
        sessionError,
      );
      // Email will remain null
      rootSpan.recordException(sessionError);
      rootSpan.setAttribute('session.error', true);
    }
    // --- End Get User Email from Session ---

    // Directly use the mode from the request body, default to 'stock' if invalid/missing
    const requestedMode = body.imageGenerationMode;
    const validModes: GenerationMode[] = [
      'stock',
      'getimg.ai',
      'fal.ai-flux-1.1-pro',
      'openai-gpt-image-1',
    ];
    const imageGenerationMode: GenerationMode =
      typeof requestedMode === 'string' &&
      validModes.includes(requestedMode as GenerationMode)
        ? (requestedMode as GenerationMode)
        : 'stock';

    console.log(`Using image generation mode: ${imageGenerationMode}`);

    if (!userPrompt || typeof userPrompt !== 'string') {
      rootSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Prompt is required',
      });
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 },
      );
    }

    if (!userId || typeof userId !== 'string') {
      rootSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'User ID is required',
      });
      return NextResponse.json(
        { error: 'User ID is required and must be a string' },
        { status: 400 },
      );
    }

    // Check that {user_prompt} is present in the prototypePrompt
    if (!prototypePrompt.includes('{user_prompt}')) {
      // This shouldn't happen if the prompt file is correct
      console.error(
        'Critical Error: Prompt placeholder {user_prompt} not found in gen-store-json-prompt.md',
      );
      return NextResponse.json(
        { error: 'Internal Server Error: Invalid prompt configuration' },
        { status: 500 },
      );
    }

    // Construct the full prompt for the AI
    const fullPrompt = prototypePrompt.replace('{user_prompt}', userPrompt);

    const overallJsonGenerationStartTime = Date.now(); // Start for total JSON generation

    // Prepare dynamic Helicone headers
    // These are the headers we want to pass to our heliconeOpenAI and heliconeGoogle functions
    const dynamicHeliconeHeaders = {
      'Helicone-User-Id': userId,
      'Helicone-Session-Id': crypto.randomUUID(), // Generate a new session for each request
      // TODO: Consider adding other dynamic headers relevant to this specific API endpoint
      // For example, if a trace ID from an upstream service is available:
      // 'Helicone-Trace-Id': req.headers.get('X-Trace-Id') || undefined,
      'Helicone-Session-Path': '/api/generate', // Example custom property for Helicone
      'Helicone-Session-Name': 'Store Generation', // Example custom property for Helicone
    };

    // Conditional model initialization
    let modelInstance: LanguageModel;
    let selectedModelLogName: string;

    const modelConfig = MODEL_CONFIGS[SELECTED_MODEL];

    if (modelConfig.provider === 'google') {
      // Pass dynamic headers to the provider function
      modelInstance = heliconeGoogle(dynamicHeliconeHeaders)(
        modelConfig.modelName,
      );
      selectedModelLogName = `Google Gemini (${modelConfig.modelName})`;
      console.log(
        `Initializing Google Gemini model: ${modelConfig.modelName} via Helicone`,
      );
    } else if (modelConfig.provider === 'openai') {
      // Pass dynamic headers to the provider function
      modelInstance = heliconeOpenAI(dynamicHeliconeHeaders)(
        modelConfig.modelName,
      );
      selectedModelLogName = `OpenAI (${modelConfig.modelName})`;
      console.log(
        `Initializing OpenAI model: ${modelConfig.modelName} via Helicone`,
      );
    } else {
      throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
    }

    // log calling the selected model
    console.log(
      `Calling ${selectedModelLogName} model with the full prompt...`,
    );

    // Call the AI using Vercel AI SDK
    const llmStartTime = Date.now();
    const { text, response } = await generateText({
      model: modelInstance,
      prompt: fullPrompt,
      system:
        'You are an AI assistant designed to output ONLY raw JSON data. Do not include any explanations, markdown formatting, or text outside the JSON structure.',
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    });
    console.log('response from generateText', response);
    const llmEndTime = Date.now();
    llmTextGenerationTimeMs = llmEndTime - llmStartTime;
    console.log(`AI text generation took ${llmTextGenerationTimeMs}ms`);

    // Parse the AI's response as JSON
    let generatedJson: unknown;
    try {
      // Attempt to remove markdown fences if present
      const cleanedText = text
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '');
      generatedJson = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON Parsing Error:', parseError);
      console.error('Raw AI Response:', text); // Log the raw text for debugging
      return NextResponse.json(
        {
          error: 'Failed to parse AI response as JSON',
          details: (parseError as Error).message,
          rawResponse: text, // Include raw response for debugging
        },
        { status: 500 },
      );
    }

    // Log the raw JSON from AI before any modifications
    console.log(
      'Raw JSON from AI (before theme injection):',
      util.inspect(generatedJson, {
        showHidden: false,
        depth: null,
        colors: true,
      }),
    );

    // Extract imageStyle from the original AI output, as it's independent of theme injection.
    const imageStyle = (generatedJson as any)?.settings?.imageStyle as
      | string
      | undefined;
    console.log(
      'Extracted imageStyle from settings:',
      imageStyle ?? 'Not Found',
    );

    // Extract chosenPaletteName from the AI output
    const chosenPaletteName = (generatedJson as any)?.settings
      ?.chosenPaletteName as string | undefined | null;
    console.log(
      'Extracted chosenPaletteName from settings:',
      chosenPaletteName ?? 'Not specified, will use default',
    );

    // Apply the chosen or default theme
    const themedJson = applyTheme(generatedJson, chosenPaletteName);

    // Log the JSON AFTER theme injection
    console.log(
      'JSON after theme injection (before image replacement):',
      util.inspect(themedJson, {
        showHidden: false,
        depth: null,
        colors: true,
      }),
    );

    // --- Replace Image Placeholders ---
    console.log('Replacing image placeholders...');
    const startTimeReplace = Date.now();
    // imageStyle is already extracted from the original generatedJson
    const finalJson = await replaceImagePlaceholders(
      themedJson, // Use the JSON with themes injected
      imageGenerationMode,
      imageStyle, // Pass the original imageStyle
    );
    const endTimeReplace = Date.now();
    imageReplacementTimeMs = endTimeReplace - startTimeReplace; // Calculate duration
    console.log(`Image replacement took ${imageReplacementTimeMs}ms`);
    // --- End Image Placeholder Replacement ---

    const overallJsonGenerationEndTime = Date.now(); // End for total JSON generation
    const totalJsonGenerationTimeMs =
      overallJsonGenerationEndTime - overallJsonGenerationStartTime;

    // --- Call YNS API ---
    const ynsApiUrl = `${process.env.NEXT_PUBLIC_YNS_API_URL}/admin/ai-test/import?userId=${userId}`;
    console.log(`Calling YNS API: ${ynsApiUrl}`);
    const ynsApiKey = process.env.YNS_AI_API_KEY;

    if (!ynsApiKey) {
      console.error('YNS_AI_API_KEY environment variable is not set.');
      return NextResponse.json(
        { error: 'Internal Server Error: API key configuration missing.' },
        { status: 500 },
      );
    }
    if (!process.env.NEXT_PUBLIC_YNS_API_URL) {
      console.error('NEXT_PUBLIC_YNS_API_URL environment variable is not set.');
      return NextResponse.json(
        { error: 'Internal Server Error: YNS API URL configuration missing.' },
        { status: 500 },
      );
    }

    try {
      const startTimeYnsApi = Date.now();
      const ynsResponse = await fetch(ynsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ynsApiKey}`,
        },
        body: JSON.stringify(finalJson), // Send the JSON with injected themes and image URLs
      });
      const endTimeYnsApi = Date.now();
      ynsApiCallTimeMs = endTimeYnsApi - startTimeYnsApi;

      if (!ynsResponse.ok) {
        const errorText = await ynsResponse.text();
        console.error(`YNS API Error (${ynsResponse.status}): ${errorText}`);
        // Attempt to parse error response if JSON
        let errorDetails: any = errorText;
        try {
          errorDetails = JSON.parse(errorText);
        } catch (e) {
          /* Ignore if not JSON */
        }

        return NextResponse.json(
          {
            error: `Failed to create store on YNS platform (Status: ${ynsResponse.status})`,
            details: errorDetails, // Forward parsed or raw error
          },
          { status: ynsResponse.status }, // Forward status code
        );
      }

      const ynsResult = await ynsResponse.json();
      console.log('YNS API Success Response:', ynsResult);

      if (!ynsResult.url) {
        console.error('YNS API response missing URL:', ynsResult);
        return NextResponse.json(
          { error: 'YNS API did not return a store URL', details: ynsResult },
          { status: 500 },
        );
      }

      // --- Save to generated_stores table ---
      const heroImageUrlToSave = extractHeroImageUrl(finalJson);

      if (!heroImageUrlToSave) {
        console.error(
          `Hero image URL could not be extracted for store generation (User: ${userId}, Prompt: "${userPrompt.substring(0, 50)}..."). Skipping database entry for generated_stores.`,
        );
      } else if (pool) {
        // Proceed only if heroImageUrlToSave is not null AND pool is available
        let dbClient: PoolClient | undefined;
        try {
          dbClient = await pool.connect();
          const insertQuery = `
              INSERT INTO generated_stores (user_id, user_email, prompt_text, store_url, hero_image_url, final_store_json)
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
            `;
          const startTimeDbSave = Date.now();
          const result = await dbClient.query(insertQuery, [
            userId,
            userEmail,
            userPrompt,
            ynsResult.url,
            heroImageUrlToSave, // Now guaranteed to be a string
            JSON.stringify(finalJson),
          ]);
          const endTimeDbSave = Date.now();
          databaseSaveTimeMs = endTimeDbSave - startTimeDbSave;

          const newEntryId = result.rows[0]?.id;
          console.log(
            `Successfully saved generated store metadata for user ${userId} (Email: ${userEmail}). URL: ${ynsResult.url}. DB Entry ID: ${newEntryId}`,
          );
        } catch (dbError: any) {
          // Explicitly type dbError
          console.error(
            'Failed to save generated store metadata to database. Store was created on YNS, but will not appear in "My Stores":',
            dbError,
          );
          // Logged error, proceed to return success to user for store generation
        } finally {
          dbClient?.release();
        }
      } else if (!pool) {
        // heroImageUrlToSave was valid, but pool is not available
        console.error(
          'Database pool not available. Skipping save of generated store metadata.',
        );
      }
      // --- End Save to generated_stores table ---

      // --- Latency Summary Logging ---
      const logIdentifier =
        userEmail || `User ID: ${userId}` || 'Unknown User/ID';
      const formatMs = (ms: number | string | null) => {
        if (typeof ms === 'string') return ms;
        if (ms === null) return 'Not executed or failed';
        return `${ms.toLocaleString('en-US')}ms`;
      };

      console.log(`
Latency Summary for Request (User: ${logIdentifier}):
- AI Text Generation: ${formatMs(llmTextGenerationTimeMs)}
- Image Processing (${imageGenerationMode}): ${formatMs(imageReplacementTimeMs)}
- YNS API Call: ${formatMs(ynsApiCallTimeMs)}
- Database Save: ${formatMs(databaseSaveTimeMs)}
`);
      // --- End Latency Summary Logging ---

      return NextResponse.json({
        storeUrl: ynsResult.url,
        storeJson: finalJson, // Return the modified JSON (which now includes injected themes and replaced images)
        generationTimeMs: totalJsonGenerationTimeMs, // This is now the end-to-end JSON gen time
        imageReplacementTimeMs: imageReplacementTimeMs, // Specific time for image replacement
      });
    } catch (ynsApiError) {
      console.error('Error calling YNS API:', ynsApiError);
      if (ynsApiError instanceof Error) {
        return NextResponse.json(
          {
            error: 'Failed to communicate with YNS platform',
            details: ynsApiError.message,
          },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: 'Failed to communicate with YNS platform (Unknown Error)' },
        { status: 500 },
      );
    }
    // --- End YNS API Call ---
  } catch (error) {
    console.error('API Error in POST handler:', error);
    // Removed the check for !pool as pool is no longer directly used here.
    // Database related startup errors would likely manifest through errors from replaceImagePlaceholders.
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Internal Server Error', details: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: 'Internal Server Error (Unknown)' },
      { status: 500 },
    );
  } finally {
    rootSpan.end();
  }
}
