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
import type { HeliconeRequestContext } from '../../lib/request-context';
import { nanoid } from 'nanoid';

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
    const clientJobId = body.jobId; // Read client-generated jobId

    // --- Validate clientJobId ---
    if (!clientJobId || typeof clientJobId !== 'string') {
      // Basic validation
      rootSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Client-generated jobId is required',
      });
      // Note: Cannot update generation_jobs table here as jobId is missing/invalid.
      return NextResponse.json(
        { error: 'Client-generated jobId is required and must be a string' },
        { status: 400 },
      );
    }
    rootSpan.setAttribute('app.jobId', clientJobId); // Add jobId to root span
    console.log('clientJobId', clientJobId);

    // --- Get User Email from Session ---
    let userEmail: string | null = null;
    const requestHeadersInternal = await headers(); // headers() is async in Next.js 15+
    try {
      const session = await auth.api.getSession({
        headers: requestHeadersInternal,
      });
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

    // --- Initialize job in database ---
    let dbClient: PoolClient | null = null;
    try {
      dbClient = await pool.connect();
      await dbClient.query(
        `INSERT INTO generation_jobs (id, user_id, status, created_at, updated_at)
         VALUES ($1, $2, 'queued', NOW(), NOW())`,
        [clientJobId, userId],
      );
      console.log(
        'Job with status "queued" inserted into database:',
        clientJobId,
      );
    } catch (dbError) {
      console.error(
        'Failed to insert initial job status into database:',
        dbError,
      );
      if (dbError instanceof Error) {
        rootSpan.recordException(dbError);
        rootSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: `DB initial insert failed: ${dbError.message}`,
        });
      } else {
        rootSpan.recordException(new Error(String(dbError)));
        rootSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'DB initial insert failed: Unknown error',
        });
      }
      // No need to update job to 'failed' here as it wasn't properly created or jobId might be the issue.
      return NextResponse.json(
        { error: 'Internal Server Error: Failed to initialize job tracking' },
        { status: 500 },
      );
    } finally {
      dbClient?.release();
    }
    // --- End Initialize job in database ---

    if (!userPrompt || typeof userPrompt !== 'string') {
      rootSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Prompt is required',
      });
      // Update job to failed before returning
      if (clientJobId) {
        try {
          dbClient = await pool.connect();
          await dbClient.query(
            `UPDATE generation_jobs SET status = 'failed', error_msg = $1, updated_at = NOW()
             WHERE id = $2`,
            [
              'Internal Server Error: Invalid prompt configuration',
              clientJobId,
            ],
          );
        } catch (dbUpdateError) {
          console.error(
            'Failed to update job status to failed in DB:',
            dbUpdateError,
          );
        } finally {
          dbClient?.release();
        }
      }
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
      // Update job to failed before returning
      if (clientJobId) {
        try {
          dbClient = await pool.connect();
          await dbClient.query(
            `UPDATE generation_jobs SET status = 'failed', error_msg = $1, updated_at = NOW()
             WHERE id = $2`,
            [
              'Internal Server Error: Invalid prompt configuration',
              clientJobId,
            ],
          );
        } catch (dbUpdateError) {
          console.error(
            'Failed to update job status to failed in DB:',
            dbUpdateError,
          );
        } finally {
          dbClient?.release();
        }
      }
      return NextResponse.json(
        { error: 'Internal Server Error: Invalid prompt configuration' },
        { status: 500 },
      );
    }

    // Construct the full prompt for the AI
    const fullPrompt = prototypePrompt.replace('{user_prompt}', userPrompt);

    // Define Helicone Context
    const vercelRequestId =
      requestHeadersInternal.get('x-vercel-id') || `localhost-${nanoid(10)}`;
    const heliconeContext: HeliconeRequestContext = {
      vercelRequestId,
      userId,
      userEmail: userEmail === null ? undefined : userEmail,
    };

    const overallJsonGenerationStartTime = Date.now(); // Start for total JSON generation

    // Prepare dynamic Helicone headers
    const vercelIdForHeliconeSession = heliconeContext.vercelRequestId;

    const dynamicHeliconeHeaders = {
      // Helicone-User-Id is a special header for user-level metrics in Helicone.
      // See: https://docs.helicone.ai/features/advanced-usage/custom-properties
      ...(heliconeContext.userId && {
        'Helicone-User-Id': heliconeContext.userId,
      }),
      ...(heliconeContext.userEmail && {
        'Helicone-Property-user-email': heliconeContext.userEmail,
      }),
      'Helicone-Session-Id': vercelIdForHeliconeSession,
      'Helicone-Session-Path': '/api/generate',
      'Helicone-Session-Name': 'Store Generation',
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
      `Calling ${selectedModelLogName} model with the full prompt for Turn 1 (Hero Content)...`,
    );

    // --- LLM Turn 1: Generate Hero Content ---
    const llmTurn1StartTime = Date.now();
    const { text: heroContentText, response: heroResponseTurn1 } =
      await generateText({
        model: modelInstance,
        system:
          'You are an AI assistant designed to output ONLY raw JSON data. Do not include any explanations, markdown formatting, or text outside the JSON structure.',
        prompt: fullPrompt, // User prompt includes instructions for Turn 1
        providerOptions: {
          // Keep existing providerOptions
          google: {
            thinkingConfig: {
              thinkingBudget: 0,
            },
          } satisfies GoogleGenerativeAIProviderOptions,
        },
      });
    const llmTurn1EndTime = Date.now();
    const llmTurn1DurationMs = llmTurn1EndTime - llmTurn1StartTime;
    console.log(`LLM Turn 1 (Hero Content) took ${llmTurn1DurationMs}ms`);
    console.log('Raw LLM Turn 1 Response (heroContentText):', heroContentText);

    let heroContentTurn1: { heroTitle?: string; heroDescription?: string };
    try {
      const cleanedHeroContentText = heroContentText
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '');
      heroContentTurn1 = JSON.parse(cleanedHeroContentText);
      if (
        typeof heroContentTurn1.heroTitle !== 'string' ||
        typeof heroContentTurn1.heroDescription !== 'string'
      ) {
        throw new Error(
          'heroTitle or heroDescription missing or not strings in Turn 1 response.',
        );
      }
    } catch (parseError) {
      console.error('LLM Turn 1 JSON Parsing Error:', parseError);
      console.error('Raw AI Response (Turn 1):', heroContentText);
      // For now, we'll throw to stop execution if Turn 1 fails, can be refined for job status 'failed' later
      throw new Error(
        `Failed to parse LLM Turn 1 response: ${(parseError as Error).message}`,
      );
    }
    console.log(
      'Parsed LLM Turn 1 Output (heroContentTurn1):',
      heroContentTurn1,
    );
    // TODO: Later, save heroContentTurn1 to generation_jobs table with status 'hero_ready'
    // --- Update job status to hero_ready ---
    try {
      dbClient = await pool.connect();
      await dbClient.query(
        `UPDATE generation_jobs SET status = 'hero_ready', hero_json = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(heroContentTurn1), clientJobId], // Store heroContentTurn1 as hero_json
      );
      console.log(
        'Job with status "hero_ready" updated in database:',
        clientJobId,
      );
    } catch (dbError) {
      console.error(
        'Failed to update job status to hero_ready in database:',
        dbError,
      );
      if (dbError instanceof Error) {
        rootSpan.recordException(dbError);
      } else {
        rootSpan.recordException(new Error(String(dbError)));
      }
      // Log error, but proceed. The final status update will capture overall success/failure.
      // Or, decide if this is critical enough to halt and set job to 'failed'.
      // For now, logging and continuing.
    } finally {
      dbClient?.release();
    }
    // --- End Update job status to hero_ready ---

    // --- Construct messages for LLM Turn 2 ---
    const turn2InstructionMessageContent = `Okay, thanks for the excellent preview of the Hero section

Now, please generate the complete store JSON as per the 'Second Task (Next Turn)' instructions in the original prompt I provided. This includes all paths, sections (using the previously generated title/description for the HeroSection on the homepage), settings, and products, following all rules from the initial comprehensive prompt.
Ensure the entire output is a single, valid JSON object. Remember to output ONLY the raw JSON.`;

    const messagesForTurn2 = [
      {
        role: 'system',
        content:
          'You are an AI assistant designed to output ONLY raw JSON data. Do not include any explanations, markdown formatting, or text outside the JSON structure.',
      } as const,
      { role: 'user', content: fullPrompt as string } as const,
      { role: 'assistant', content: heroContentText as string } as const,
      {
        role: 'user',
        content: turn2InstructionMessageContent as string,
      } as const,
    ];

    // --- LLM Turn 2: Generate Full Store JSON ---
    console.log(
      `Calling ${selectedModelLogName} model for Turn 2 (Full Store JSON)...`,
    );
    const llmTurn2StartTime = Date.now();
    // Note: variable 'text' will now hold the full store JSON from turn 2
    // variable 'response' will now hold the full response object from turn 2
    const { text, response } = await generateText({
      model: modelInstance,
      messages: messagesForTurn2, // Pass the constructed message history
      providerOptions: {
        // Keep existing providerOptions
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
          },
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    });
    const llmTurn2EndTime = Date.now();
    const llmTurn2DurationMs = llmTurn2EndTime - llmTurn2StartTime;
    llmTextGenerationTimeMs = llmTurn1DurationMs + llmTurn2DurationMs; // Sum of durations
    console.log(`LLM Turn 2 (Full Store JSON) took ${llmTurn2DurationMs}ms`);
    console.log(`Total LLM text generation time: ${llmTextGenerationTimeMs}ms`);
    // TODO: Later, implement the backend safety-net check/override for heroTitle/Description here.
    // For now, we assume the LLM correctly incorporates them.

    // Parse the AI's response as JSON (this is now from Turn 2)
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
      // Update job to failed before returning
      if (clientJobId) {
        try {
          dbClient = await pool.connect();
          await dbClient.query(
            `UPDATE generation_jobs SET status = 'failed', error_msg = $1, updated_at = NOW()
             WHERE id = $2`,
            [
              `Failed to parse AI response as JSON: ${(parseError as Error).message}`,
              clientJobId,
            ],
          );
        } catch (dbUpdateError) {
          console.error(
            'Failed to update job status to failed in DB:',
            dbUpdateError,
          );
        } finally {
          dbClient?.release();
        }
      }
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
      heliconeContext, // Pass the context here
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
        const errorBody = await ynsResponse.text(); // Use text() for non-JSON or to see raw error
        console.error('YNS API Error:', ynsResponse.status, errorBody);
        // Update job to failed before returning
        if (clientJobId) {
          try {
            dbClient = await pool.connect();
            await dbClient.query(
              `UPDATE generation_jobs SET status = 'failed', error_msg = $1, updated_at = NOW()
               WHERE id = $2`,
              [
                `YNS API Error: ${ynsResponse.status} ${errorBody}`.substring(
                  0,
                  1000,
                ),
                clientJobId,
              ], // Limit error message length
            );
          } catch (dbUpdateError) {
            console.error(
              'Failed to update job status to failed in DB:',
              dbUpdateError,
            );
          } finally {
            dbClient?.release();
          }
        }
        return NextResponse.json(
          {
            error: `Failed to create store on YNS platform (Status: ${ynsResponse.status})`,
            details: errorBody, // Forward parsed or raw error
          },
          { status: ynsResponse.status }, // Forward status code
        );
      }

      const ynsData = await ynsResponse.json();
      const storeUrl = ynsData.url; // Assuming the response has a "domain" field

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
            storeUrl,
            heroImageUrlToSave, // Now guaranteed to be a string
            JSON.stringify(finalJson),
          ]);
          const endTimeDbSave = Date.now();
          databaseSaveTimeMs = endTimeDbSave - startTimeDbSave;

          const newEntryId = result.rows[0]?.id;
          console.log(
            `Successfully saved generated store metadata for user ${userId} (Email: ${userEmail}). URL: ${storeUrl}. DB Entry ID: ${newEntryId}`,
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

      // --- Update job status to full_ready ---
      if (clientJobId) {
        try {
          dbClient = await pool.connect();
          await dbClient.query(
            `UPDATE generation_jobs
             SET status = 'full_ready', full_json = $1, store_url = $2, updated_at = NOW()
             WHERE id = $3`,
            [JSON.stringify(finalJson), storeUrl, clientJobId],
          );
          console.log(
            'Job with status "full_ready" updated in database:',
            clientJobId,
          );
        } catch (dbError) {
          console.error(
            'Failed to update job status to full_ready in database:',
            dbError,
          );
          if (dbError instanceof Error) {
            rootSpan.recordException(dbError);
          } else {
            rootSpan.recordException(new Error(String(dbError)));
          }
          // Log error. The client will still get the response, but job status might be inconsistent.
        } finally {
          dbClient?.release();
        }
      }
      // --- End Update job status to full_ready ---

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
        storeUrl: storeUrl,
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
  } catch (error: any) {
    console.error('Unhandled error in /api/generate:', error);
    if (error instanceof Error) {
      rootSpan.recordException(error);
      rootSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    } else {
      rootSpan.recordException(new Error(String(error)));
      rootSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Unhandled error: Unknown type',
      });
    }

    // --- Update job status to failed for unhandled errors ---
    // Need to access clientJobId if possible. It might not be set if error is very early.
    // This assumes clientJobId was parsed from the body before the error.
    // If error happened before body parsing, clientJobId might be undefined.
    const requestBodyForError = await req.json().catch(() => ({})); // Safely try to get body again or use empty
    const jobIdForError = requestBodyForError.jobId;

    if (jobIdForError) {
      let dbClient: PoolClient | null = null;
      try {
        dbClient = await pool.connect();
        await dbClient.query(
          `UPDATE generation_jobs SET status = 'failed', error_msg = $1, updated_at = NOW()
           WHERE id = $2`,
          [
            (error instanceof Error ? error.message : String(error)).substring(
              0,
              1000,
            ),
            jobIdForError,
          ], // Limit error message length
        );
      } catch (dbUpdateError) {
        console.error(
          'Failed to update job status to failed in DB after unhandled error:',
          dbUpdateError,
        );
      } finally {
        dbClient?.release();
      }
    }
    // --- End Update job status to failed ---

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  } finally {
    rootSpan.end();
  }
}
