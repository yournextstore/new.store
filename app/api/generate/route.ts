import { NextResponse } from 'next/server';
import { generateText, type LanguageModel } from 'ai';
import { heliconeOpenAI, heliconeGoogle } from '../../lib/ai-providers';
import { trace, type Span, SpanStatusCode } from '@opentelemetry/api';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import type { Pool, PoolClient } from 'pg'; // Import PoolClient and Pool for typing
import type { GenerationMode } from '../../lib/image-generation';
import { applyTheme } from '../../lib/theme';
import { replaceImagePlaceholders } from '../../lib/image';
import { pool } from '@/lib/db'; // Using @ alias for path
import { auth } from '@/lib/auth'; // For getting user session
import { headers } from 'next/headers'; // For getting headers for session
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import type { HeliconeRequestContext } from '../../lib/request-context';
import { nanoid } from 'nanoid';

import { handleGenerationError } from '../../../lib/generation-error-handler';
import {
  initializeJob,
  updateJobToHeroReady,
  updateJobToStoreSkeletonReady,
  updateJobToImageProcessing,
  updateJobToImagesResolved,
  updateJobToStoreReady,
} from '../../../lib/generation-job-tracker';

import { findImageInDB } from '../../lib/image'; // Corrected import path for Task 6
import { SELECTED_MODEL, MODEL_CONFIGS } from './ai-model-config'; // Added import

const tracer = trace.getTracer('ai-generate-route-tracer');

interface GenerationRequestContext {
  userId: string;
  clientJobId: string;
  userPrompt: string;
  userEmail: string | null;
  imageGenerationMode: GenerationMode;
  rootSpan: Span;
  heliconeContext: HeliconeRequestContext;
  dbPool: Pool;
}

// Helper function to prepare Helicone headers
function prepareHeliconeHeaders(
  heliconeContext: HeliconeRequestContext,
): Record<string, string> {
  const headers: Record<string, string> = {}; // Initialize as empty

  // These are always present in the context of this route, even if HeliconeRequestContext allows them to be optional generally
  // However, to be safe and align with HeliconeRequestContext, we check.
  if (typeof heliconeContext.vercelRequestId === 'string') {
    headers['Helicone-Session-Id'] = heliconeContext.vercelRequestId;
  }
  // For this specific route, these are fixed values.
  headers['Helicone-Session-Path'] = '/api/generate';
  headers['Helicone-Session-Name'] = 'Store Generation';

  if (typeof heliconeContext.userId === 'string') {
    headers['Helicone-User-Id'] = heliconeContext.userId;
  }

  if (typeof heliconeContext.userEmail === 'string') {
    headers['Helicone-Property-user-email'] = heliconeContext.userEmail;
  }

  return headers;
}

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
  let clientJobId: string | undefined = undefined;

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
    clientJobId = body.jobId; // Assign clientJobId here

    // --- Validate clientJobId ---
    if (!clientJobId || typeof clientJobId !== 'string') {
      // Basic validation
      return handleGenerationError({
        error: new Error(
          'Client-generated jobId is required and must be a string',
        ),
        span: rootSpan,
        // No jobId to update here, as it's missing/invalid
        dbPool: pool,
        responseDetails: {
          clientMessage:
            'Client-generated jobId is required and must be a string',
          statusCode: 400,
        },
        operationContext: 'Validating clientJobId',
      });
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

    // --- Create HeliconeRequestContext (needed for GenerationRequestContext) ---
    const vercelRequestId =
      requestHeadersInternal.get('x-vercel-id') || `localhost-${nanoid(10)}`;
    const heliconeCtxForContext: HeliconeRequestContext = {
      vercelRequestId,
      userId: userId,
      userEmail: userEmail === null ? undefined : userEmail,
    };

    // --- Crucial Validations before creating full context ---
    // User prompt validation (moved up before context creation that uses it)
    if (!userPrompt || typeof userPrompt !== 'string') {
      return handleGenerationError({
        error: new Error('Prompt is required and must be a string'),
        span: rootSpan,
        jobId: clientJobId, // clientJobId is validated by this point
        dbPool: pool,
        responseDetails: {
          clientMessage: 'Prompt is required and must be a string',
          statusCode: 400,
          dbErrorMessage: 'Prompt is required and must be a string',
        },
        operationContext: 'Validating userPrompt (pre-context)',
      });
    }

    // User ID validation (moved up before context creation that uses it)
    if (!userId || typeof userId !== 'string') {
      return handleGenerationError({
        error: new Error('User ID is required and must be a string'),
        span: rootSpan,
        jobId: clientJobId, // clientJobId is validated
        dbPool: pool,
        responseDetails: {
          clientMessage: 'User ID is required and must be a string',
          statusCode: 400,
          dbErrorMessage: 'User ID is required and must be a string',
        },
        operationContext: 'Validating userId (pre-context)',
      });
    }
    // Now all components of context are validated and ready.
    const context: GenerationRequestContext = {
      userId: userId,
      clientJobId: clientJobId,
      userPrompt: userPrompt,
      userEmail: userEmail,
      imageGenerationMode: imageGenerationMode,
      rootSpan: rootSpan,
      heliconeContext: heliconeCtxForContext,
      dbPool: pool,
    };

    // --- Initialize job in database ---
    // This call will now throw if DB operation fails.
    // The error will be caught by the main try/catch block of the POST function.
    await initializeJob(
      context.dbPool,
      context.clientJobId,
      context.userId,
      context.rootSpan,
    );
    // --- End Initialize job in database ---

    // Check that {user_prompt} is present in the prototypePrompt (uses context.userPrompt indirectly via fullPrompt)
    if (!prototypePrompt.includes('{user_prompt}')) {
      console.error(
        'Critical Error: Prompt placeholder {user_prompt} not found in gen-store-json-prompt.md',
      );
      return handleGenerationError({
        error: new Error('Prompt placeholder {user_prompt} not found'),
        span: context.rootSpan, // Use context
        jobId: context.clientJobId, // Use context
        dbPool: context.dbPool, // Use context
        responseDetails: {
          clientMessage: 'Internal Server Error: Invalid prompt configuration',
          statusCode: 500,
          dbErrorMessage:
            'Critical Error: Prompt placeholder {user_prompt} not found in gen-store-json-prompt.md',
        },
        operationContext: 'Validating prototypePrompt content',
      });
    }

    const fullPrompt = prototypePrompt.replace(
      '{user_prompt}',
      context.userPrompt,
    ); // Use context
    const overallJsonGenerationStartTime = Date.now();

    const dynamicHeliconeHeaders = prepareHeliconeHeaders(
      context.heliconeContext,
    );

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

    let heroContentTurn1: {
      heroTitle?: string;
      heroDescription?: string;
      heroImageDescription?: string; // Added for Task 6
    };
    try {
      const cleanedHeroContentText = heroContentText
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '');
      heroContentTurn1 = JSON.parse(cleanedHeroContentText);
      if (
        typeof heroContentTurn1.heroTitle !== 'string' ||
        typeof heroContentTurn1.heroDescription !== 'string' ||
        typeof heroContentTurn1.heroImageDescription !== 'string' // Added for Task 6
      ) {
        throw new Error(
          'heroTitle, heroDescription, or heroImageDescription missing or not strings in Turn 1 response.',
        );
      }
    } catch (parseError) {
      console.error('LLM Turn 1 JSON Parsing Error:', parseError);
      console.error('Raw AI Response (Turn 1):', heroContentText);
      return handleGenerationError({
        error: parseError,
        span: context.rootSpan, // Use context
        jobId: context.clientJobId, // Use context
        dbPool: context.dbPool, // Use context
        responseDetails: {
          clientMessage: 'Failed to parse AI response for hero content',
          statusCode: 500,
          dbErrorMessage: `Failed to parse LLM Turn 1 response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          rawResponse: heroContentText,
        },
        operationContext: 'Parsing LLM Turn 1 (Hero Content) JSON',
      });
    }
    console.log(
      'Parsed LLM Turn 1 Output (heroContentTurn1):',
      heroContentTurn1,
    );

    // --- [Task 6] Fast Hero Image Lookup ---
    let actualHeroImageUrl: string | null = null;
    if (heroContentTurn1.heroImageDescription) {
      try {
        console.log(
          `Attempting to find hero image for description: "${heroContentTurn1.heroImageDescription}" for job ${context.clientJobId}`,
        );
        actualHeroImageUrl = await findImageInDB(
          heroContentTurn1.heroImageDescription,
          'hero', // imageType
          undefined, // alignment - findImageInDB should ideally handle this gracefully or be updated
          context.heliconeContext, // Pass heliconeContext
          true, // <--- Set debugTopN to true for logging top 5 candidates
        );
        console.log(
          `Looked up hero image. URL: ${actualHeroImageUrl ?? 'Not found'}`,
        );
      } catch (lookupError) {
        console.error('Hero image lookup failed:', lookupError);
        // Adhering to existing error handling pattern:
        // Log, record exception on span, set attribute, and continue.
        context.rootSpan.recordException(
          lookupError instanceof Error
            ? lookupError
            : new Error(String(lookupError)),
        );
        context.rootSpan.setAttribute('app.heroImageLookup.error', true);
        // actualHeroImageUrl remains null, which is the desired fallback.
      }
    }
    // --- End [Task 6] Fast Hero Image Lookup ---

    // Update job to hero_ready. Errors here are logged by the helper but don't stop the flow.
    const heroJsonForDb = {
      heroTitle: heroContentTurn1.heroTitle,
      heroDescription: heroContentTurn1.heroDescription,
      heroImageUrl: actualHeroImageUrl, // This will be null if lookup failed or no description
    };

    await updateJobToHeroReady(
      context.dbPool,
      context.clientJobId,
      heroJsonForDb, // Pass the object with the resolved image URL
      context.rootSpan,
    );

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

    // At this point, 'text' contains the full store JSON with image placeholders
    // It might have been modified by the safety-net check for hero content (TODO for that check)
    // For now, we assume 'text' is the string representation of full_json with placeholders

    let generatedJsonWithPlaceholders: unknown;
    try {
      const cleanedText = text
        .trim()
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '');
      generatedJsonWithPlaceholders = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error(
        'LLM Turn 2 JSON Parsing Error (full store with placeholders):',
        parseError,
      );
      console.error('Raw AI Response (Turn 2):', text);
      return handleGenerationError({
        error: parseError,
        span: context.rootSpan,
        jobId: context.clientJobId,
        dbPool: context.dbPool,
        responseDetails: {
          clientMessage:
            'Failed to parse AI response (JSON) for full store structure',
          statusCode: 500,
          dbErrorMessage: `Failed to parse LLM Turn 2 response (full store with placeholders): ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          rawResponse: text,
        },
        operationContext:
          'Parsing LLM Turn 2 (Full Store JSON with placeholders)',
      });
    }

    // Update job to store_skeleton_ready
    await updateJobToStoreSkeletonReady(
      context.dbPool,
      context.clientJobId,
      generatedJsonWithPlaceholders, // This is the parsed full_json with placeholders
      context.rootSpan,
    );

    // Log the raw JSON from AI before any modifications like theme injection
    console.log(
      'Raw JSON from AI (before theme injection):',
      util.inspect(generatedJsonWithPlaceholders, {
        showHidden: false,
        depth: null,
        colors: true,
      }),
    );

    // Extract imageStyle from the original AI output, as it's independent of theme injection.
    const imageStyle = (generatedJsonWithPlaceholders as any)?.settings
      ?.imageStyle as string | undefined;
    console.log(
      'Extracted imageStyle from settings:',
      imageStyle ?? 'Not Found',
    );

    // Extract chosenPaletteName from the AI output
    const chosenPaletteName = (generatedJsonWithPlaceholders as any)?.settings
      ?.chosenPaletteName as string | undefined | null;
    console.log(
      'Extracted chosenPaletteName from settings:',
      chosenPaletteName ?? 'Not specified, will use default',
    );

    // Apply the chosen or default theme
    const themeAppliedJson = applyTheme(
      generatedJsonWithPlaceholders,
      chosenPaletteName,
    );
    console.log(
      'JSON after theme injection:',
      util.inspect(themeAppliedJson, {
        showHidden: false,
        depth: null,
        colors: true,
      }),
    );

    // --- Image Placeholder Replacement ---
    const imageReplacementStartTime = Date.now();
    let finalJsonWithImages: any;

    // Update job to image_processing before starting image replacement
    await updateJobToImageProcessing(
      context.dbPool,
      context.clientJobId,
      context.rootSpan,
    );

    try {
      finalJsonWithImages = await tracer.startActiveSpan(
        'replaceImagePlaceholders-operation',
        async (replaceSpan) => {
          try {
            const result = await replaceImagePlaceholders(
              themeAppliedJson,
              context.imageGenerationMode,
              imageStyle, // Pass the extracted imageStyle. This can be string | null | undefined
              context.heliconeContext,
            );
            replaceSpan.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (imageError) {
            replaceSpan.recordException(imageError as Error);
            replaceSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: (imageError as Error).message,
            });
            throw imageError; // Re-throw to be caught by outer try/catch
          }
        },
      );
    } catch (imageProcessingError) {
      // This catch block handles errors specifically from replaceImagePlaceholders
      return handleGenerationError({
        error: imageProcessingError,
        span: context.rootSpan, // Root span for overall job failure
        jobId: context.clientJobId,
        dbPool: context.dbPool,
        responseDetails: {
          clientMessage: 'Error processing or selecting images for your store',
          statusCode: 500,
          dbErrorMessage: `Image processing failed: ${imageProcessingError instanceof Error ? imageProcessingError.message : String(imageProcessingError)}`,
        },
        operationContext: 'Image Placeholder Replacement',
      });
    }
    imageReplacementTimeMs = Date.now() - imageReplacementStartTime;
    console.log(
      `Image placeholder replacement took ${imageReplacementTimeMs}ms`,
    );
    console.log(
      'Final JSON after image replacement:',
      util.inspect(finalJsonWithImages, {
        showHidden: false,
        depth: null,
        colors: true,
      }),
    );

    // Update job to images_resolved
    await updateJobToImagesResolved(
      context.dbPool,
      context.clientJobId,
      finalJsonWithImages, // This is the full_json with resolved image URLs
      context.rootSpan,
    );

    // --- YNS API Call ---
    const ynsApiCallStartTime = Date.now();
    const ynsApiUrl = `${process.env.NEXT_PUBLIC_YNS_API_URL}/admin/ai-test/import?userId=${userId}`;
    console.log(`Calling YNS API: ${ynsApiUrl}`);
    const ynsApiKey = process.env.YNS_AI_API_KEY;

    if (!ynsApiKey) {
      return handleGenerationError({
        error: new Error('YNS_AI_API_KEY environment variable is not set.'),
        span: rootSpan,
        jobId: clientJobId,
        dbPool: pool,
        responseDetails: {
          clientMessage:
            'Internal Server Error: API key configuration missing.',
          statusCode: 500,
          dbErrorMessage: 'YNS_AI_API_KEY environment variable is not set.',
        },
        operationContext: 'Checking YNS_AI_API_KEY',
      });
    }
    if (!process.env.NEXT_PUBLIC_YNS_API_URL) {
      return handleGenerationError({
        error: new Error(
          'NEXT_PUBLIC_YNS_API_URL environment variable is not set.',
        ),
        span: rootSpan,
        jobId: clientJobId,
        dbPool: pool,
        responseDetails: {
          clientMessage:
            'Internal Server Error: YNS API URL configuration missing.',
          statusCode: 500,
          dbErrorMessage:
            'NEXT_PUBLIC_YNS_API_URL environment variable is not set.',
        },
        operationContext: 'Checking NEXT_PUBLIC_YNS_API_URL',
      });
    }

    try {
      const startTimeYnsApi = Date.now();
      const ynsResponse = await fetch(ynsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ynsApiKey}`,
        },
        body: JSON.stringify(finalJsonWithImages), // Send the JSON with injected themes and image URLs
      });
      const endTimeYnsApi = Date.now();
      ynsApiCallTimeMs = endTimeYnsApi - startTimeYnsApi;

      if (!ynsResponse.ok) {
        const errorBody = await ynsResponse.text(); // Use text() for non-JSON or to see raw error
        console.error('YNS API Error:', ynsResponse.status, errorBody);
        return handleGenerationError({
          error: new Error(`YNS API Error: ${ynsResponse.status} ${errorBody}`),
          span: context.rootSpan, // Use context
          jobId: context.clientJobId, // Use context
          dbPool: context.dbPool, // Use context
          responseDetails: {
            clientMessage: `Failed to create store on YNS platform (Status: ${ynsResponse.status})`,
            statusCode: ynsResponse.status, // Forward YNS status code
            errorDetails: errorBody,
            dbErrorMessage: `YNS API Error: ${ynsResponse.status} ${errorBody}`,
          },
          operationContext: 'YNS API Call (non-OK response)',
        });
      }

      const ynsData = await ynsResponse.json();
      const storeUrl = ynsData.url; // Assuming the response has a "domain" field

      // --- Save to generated_stores table ---
      // This section should only execute if the YNS API call was successful
      // and we have a valid storeUrl.
      if (storeUrl && typeof storeUrl === 'string') {
        const heroImageUrl = extractHeroImageUrl(finalJsonWithImages);
        if (!heroImageUrl) {
          // Log a warning but don't fail the entire generation if hero image URL can't be found
          // It might not be critical for the generated_stores record or might be handled by YNS defaults
          console.warn(
            `Could not extract hero_image_url from finalJsonWithImages for job ${context.clientJobId}. It will be NULL or default in generated_stores.`,
          );
          context.rootSpan.setAttribute(
            'app.extractHeroImageUrl.warning',
            'Hero image URL not found in final JSON',
          );
        }

        const dbSaveStartTime = Date.now();
        try {
          const dbClientForSave = await context.dbPool.connect();
          try {
            await dbClientForSave.query(
              `INSERT INTO generated_stores (user_id, user_email, prompt_text, store_url, hero_image_url, final_store_json, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [
                context.userId,
                context.userEmail, // This can be null
                context.userPrompt,
                storeUrl,
                heroImageUrl, // This can be null if not found
                JSON.stringify(finalJsonWithImages), // Store the final JSON
              ],
            );
            console.log(
              `Store details saved to generated_stores for job ${context.clientJobId}.`,
            );
            databaseSaveTimeMs = Date.now() - dbSaveStartTime;
          } finally {
            dbClientForSave.release();
          }
        } catch (dbError) {
          const dbSaveErrorMessage =
            dbError instanceof Error ? dbError.message : String(dbError);
          console.error(
            `Error saving to generated_stores for job ${context.clientJobId}: ${dbSaveErrorMessage}`,
          );
          context.rootSpan.recordException(
            dbError instanceof Error ? dbError : new Error(dbSaveErrorMessage),
          );
          context.rootSpan.setAttribute('db.generated_stores.save.error', true);
          // Do not re-throw or return handleGenerationError here for generated_stores save failure.
          // The primary generation is successful if YNS API call succeeded.
          // This is a secondary logging/archival step.
          databaseSaveTimeMs = `Error: ${dbSaveErrorMessage.substring(0, 100)}`;
        }
      } else {
        // This case should ideally not be reached if YNS API call succeeded
        // but storeUrl is somehow invalid. Log it if it happens.
        console.error(
          `YNS API call reported success but storeUrl is invalid for job ${context.clientJobId}. Skipping generated_stores save.`,
        );
        context.rootSpan.setAttribute(
          'app.ynsApi.storeUrl.invalid',
          'storeUrl missing or invalid after successful YNS call',
        );
      }

      // Update job to store_ready (this was previously full_ready)
      await updateJobToStoreReady(
        context.dbPool,
        context.clientJobId,
        storeUrl || 'error: storeUrl not retrieved', // Pass storeUrl, provide fallback for safety
        context.rootSpan,
      );

      // --- Latency Summary Logging ---
      const logIdentifier =
        context.userEmail || `User ID: ${context.userId}` || 'Unknown User/ID'; // Use context
      const formatMs = (ms: number | string | null) => {
        if (typeof ms === 'string') return ms;
        if (ms === null) return 'Not executed or failed';
        return `${ms.toLocaleString('en-US')}ms`;
      };
      console.log(`
Latency Summary for Request (User: ${logIdentifier}):
- AI Text Generation: ${formatMs(llmTextGenerationTimeMs)}
- Image Processing (${context.imageGenerationMode}): ${formatMs(imageReplacementTimeMs)} 
- YNS API Call: ${formatMs(ynsApiCallTimeMs)}
- Database Save: ${formatMs(databaseSaveTimeMs)}
`);
      // --- End Latency Summary Logging ---

      return NextResponse.json({
        storeUrl: storeUrl,
        storeJson: finalJsonWithImages, // Return the modified JSON (which now includes injected themes and replaced images)
        generationTimeMs: llmTextGenerationTimeMs, // This is now the end-to-end JSON gen time
        imageReplacementTimeMs: imageReplacementTimeMs, // Specific time for image replacement
      });
    } catch (ynsApiError) {
      return handleGenerationError({
        error: ynsApiError,
        span: context.rootSpan, // Use context
        jobId: context.clientJobId, // Use context
        dbPool: context.dbPool, // Use context
        responseDetails: {
          clientMessage: 'Failed to communicate with YNS platform',
          statusCode: 500,
          dbErrorMessage: `Error calling YNS API: ${ynsApiError instanceof Error ? ynsApiError.message : String(ynsApiError)}`,
        },
        operationContext: 'YNS API Call (fetch/communication error)',
      });
    }
    // --- End YNS API Call ---
  } catch (error: any) {
    // This main catch block will now also handle errors from _initializeJob
    return handleGenerationError({
      error: error,
      span: rootSpan,
      jobId: clientJobId,
      dbPool: pool,
      responseDetails: {
        clientMessage: 'Internal Server Error',
        // If error is from _initializeJob, its specific message will be in error.message
        // handleGenerationError already uses error.message for details and dbErrorMessage if not overridden
        statusCode: 500,
      },
      // The operationContext here is generic; handleGenerationError provides more detail from the error itself.
      operationContext:
        error.operationContext || 'Unhandled error in /api/generate', // Allow error to carry specific context
    });
  } finally {
    rootSpan.end();
  }
}
