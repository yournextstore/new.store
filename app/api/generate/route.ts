import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PoolClient } from 'pg'; // Import PoolClient for typing
import type { GenerationMode } from '../../lib/image-generation';
import { applyTheme } from '../../lib/theme';
import { replaceImagePlaceholders } from '../../lib/image';
import { pool } from '@/lib/db'; // Using @ alias for path
import { auth } from '@/lib/auth'; // For getting user session
import { headers } from 'next/headers'; // For getting headers for session

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
  try {
    // main prompt that generates the complete store JSON representation
    const prototypePrompt = await fs.readFile(
      path.join(process.cwd(), 'app/api/generate/gen-store-json-prompt.md'),
      'utf-8',
    );
    console.log('Loaded `gen-store-json-prompt.md`');
    console.log('prototypePrompt', prototypePrompt);

    const body = await req.json();
    const userPrompt = body.prompt;
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
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 },
      );
    }

    if (!userId || typeof userId !== 'string') {
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

    const startTime = Date.now(); // Record start time

    // Call the AI using Vercel AI SDK
    const { text } = await generateText({
      // model: openai.chat('gpt-4o'), // Or use openai.chat if preferred
      model: openai.responses('gpt-4o'),
      prompt: fullPrompt,
      // Optional: Add system prompt or other parameters if needed
      system:
        'You are an AI assistant designed to output ONLY raw JSON data. Do not include any explanations, markdown formatting, or text outside the JSON structure.',
    });

    const endTime = Date.now(); // Record end time
    const generationTimeMs = endTime - startTime; // Calculate duration
    console.log(`AI generation took ${generationTimeMs}ms`);

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
      JSON.stringify(generatedJson, null, 2),
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
      JSON.stringify(themedJson, null, 2),
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
    console.log(
      `Image replacement took ${endTimeReplace - startTimeReplace}ms`,
    );
    // --- End Image Placeholder Replacement ---

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
      const ynsResponse = await fetch(ynsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ynsApiKey}`,
        },
        body: JSON.stringify(finalJson), // Send the JSON with injected themes and image URLs
      });

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
              VALUES ($1, $2, $3, $4, $5, $6);
            `;
          await dbClient.query(insertQuery, [
            userId,
            userEmail,
            userPrompt,
            ynsResult.url,
            heroImageUrlToSave, // Now guaranteed to be a string
            JSON.stringify(finalJson),
          ]);
          console.log(
            `Successfully saved generated store metadata for user ${userId} (Email: ${userEmail}). URL: ${ynsResult.url}`,
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

      // Return the YNS store URL, the *final* JSON (with replaced images), and generation times
      return NextResponse.json({
        storeUrl: ynsResult.url,
        storeJson: finalJson, // Return the modified JSON (which now includes injected themes and replaced images)
        generationTimeMs,
        imageReplacementTimeMs: endTimeReplace - startTimeReplace,
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
  }
}
