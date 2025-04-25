import { NextResponse } from 'next/server';
import { generateText, cosineSimilarity, embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

// --- Constants & Types ---
const EMBEDDING_MODEL = openai.embedding('text-embedding-3-small');
const SIMILARITY_THRESHOLD = 0.45; // Adjust as needed
const FALLBACK_IMAGE_URL = 'https://via.placeholder.com/300'; // Use a generic placeholder URL if no match found
const COSINE_DISTANCE_THRESHOLD = 1 - SIMILARITY_THRESHOLD; // pgvector uses distance

// --- Database Connection ---
let pool: Pool;
try {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL environment variable is not set.');
  }
  pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    // Add SSL config if needed for Neon or other providers
    // ssl: { rejectUnauthorized: false } // Example for Neon, adjust as necessary
  });

  // Test connection on initialization (optional but recommended)
  pool
    .query('SELECT NOW()')
    .then(() => {
      console.log('Database pool connected successfully.');
    })
    .catch((err) => {
      console.error('Database pool connection failed:', err);
      // Depending on requirements, you might want to throw or handle differently
    });
} catch (error) {
  console.error('Failed to initialize database pool:', error);
  // Handle critical initialization error - maybe the app can't run without DB?
  // For now, log the error. The absence of the pool will cause errors later.
  pool = null as any; // Set pool to null/invalid state if init fails
}

// --- New Database Query Function ---
async function findImageInDB(
  description: string,
  imageType: 'hero' | 'product',
  alignment?: 'left' | 'right',
): Promise<string | null> {
  if (!pool) {
    console.error('Database pool is not initialized. Cannot query images.');
    return null;
  }
  if (!description) return null;

  let bestMatchUrl: string | null = null;

  try {
    const { embedding } = await embed({
      model: EMBEDDING_MODEL,
      value: description,
    });

    // Format the embedding array into the string format pgvector expects
    const embeddingString = JSON.stringify(embedding);

    const client = await pool.connect(); // Get connection from pool

    try {
      if (imageType === 'hero') {
        if (!alignment) {
          console.warn('Hero image search called without alignment. Skipping.');
          return null;
        }
        // Query 1: Alignment + Threshold
        const query1 = `
          SELECT blob_url
          FROM images
          WHERE filename LIKE '%-hero-%' -- Use filename convention
            AND layout_hint = $1
            AND source = 'static' -- Ensure it's from the library build
            AND embedding <=> $2::vector < $3
          ORDER BY embedding <=> $2::vector ASC
          LIMIT 1;
        `;
        const result1 = await client.query(query1, [
          alignment,
          embeddingString,
          COSINE_DISTANCE_THRESHOLD,
        ]);

        if (result1.rows.length > 0) {
          bestMatchUrl = result1.rows[0].blob_url;
          console.log(
            `DB Hero Match (Align + Threshold): Found ${bestMatchUrl} for alignment ${alignment}`,
          );
        } else {
          // Query 2: Alignment Only (Fallback 1)
          console.log(
            `DB Hero Fallback 1: Searching alignment "${alignment}" without threshold...`,
          );
          const query2 = `
            SELECT blob_url
            FROM images
            WHERE filename LIKE '%-hero-%' -- Use filename convention
              AND layout_hint = $1
              AND source = 'static' -- Ensure it's from the library build
            ORDER BY embedding <=> $2::vector ASC
            LIMIT 1;
          `;
          const result2 = await client.query(query2, [
            alignment,
            embeddingString,
          ]);
          if (result2.rows.length > 0) {
            bestMatchUrl = result2.rows[0].blob_url;
            console.log(
              `DB Hero Match (Align Only): Found ${bestMatchUrl} for alignment ${alignment}`,
            );
          } else {
            console.log(
              `DB Hero Fallback 2: No match found for alignment "${alignment}" even without threshold.`,
            );
          }
        }
      } else if (imageType === 'product') {
        const query = `
          SELECT blob_url
          FROM images
          WHERE blob_pathname LIKE 'library/%/products/%' -- Match product paths with intermediate dir
            AND source = 'static' -- Ensure it's from the library build
            AND embedding <=> $1::vector < $2
          ORDER BY embedding <=> $1::vector ASC
          LIMIT 1;
        `;
        const result = await client.query(query, [
          embeddingString,
          COSINE_DISTANCE_THRESHOLD,
        ]);
        if (result.rows.length > 0) {
          bestMatchUrl = result.rows[0].blob_url;
          console.log(`DB Product Match: Found ${bestMatchUrl}`);
        } else {
          console.log(
            `DB Product Match: No suitable match found below threshold for description "${description.substring(0, 50)}..."`,
          );
        }
      }
    } finally {
      client.release(); // Release connection back to the pool
    }
  } catch (error) {
    console.error(
      `Error querying database for ${imageType} image (Desc: "${description.substring(0, 50)}...") :`,
      error,
    );
    return null; // Return null on error
  }

  return bestMatchUrl;
}

// --- Image Placeholder Replacement Logic (Refactored) ---
async function replaceImagePlaceholders(json: any): Promise<any> {
  let totalPlaceholders = 0;
  let successfulMatches = 0;

  if (!pool) {
    console.warn('Database pool not available. Skipping image replacement.');
    return json;
  }

  if (!json || typeof json !== 'object') return json; // Basic type check

  if (json.paths && typeof json.paths === 'object') {
    for (const pathKey in json.paths) {
      if (Array.isArray(json.paths[pathKey])) {
        for (const section of json.paths[pathKey]) {
          // --- HERO SECTION PROCESSING ---
          if (section && section.id === 'HeroSection') {
            const processSlide = async (slide: any) => {
              if (
                !slide?.image ||
                typeof slide.image.src !== 'string' ||
                !slide.image.src.startsWith('https://yns.img?description=')
              ) {
                return; // Skip if not a valid placeholder
              }

              const placeholderUrl = slide.image.src;
              const alignment = (
                slide.boxAlignment?.toLowerCase() === 'right' ? 'right' : 'left'
              ) as 'left' | 'right'; // Default to left if invalid/missing

              try {
                const url = new URL(placeholderUrl);
                const description = url.searchParams.get('description');

                if (description) {
                  totalPlaceholders++;
                  const bestMatchUrl = await findImageInDB(
                    description,
                    'hero',
                    alignment,
                  );

                  if (bestMatchUrl) {
                    slide.image.src = bestMatchUrl;
                    successfulMatches++;
                    console.log(
                      `Hero Image Match: Replaced placeholder for alignment "${alignment}" with ${bestMatchUrl}`,
                    );
                  } else {
                    slide.image.src = FALLBACK_IMAGE_URL;
                    console.warn(
                      `Hero Fallback Final: No image found matching alignment "${alignment}" for description "${description}". Using fallback URL.`,
                    );
                  }
                } else {
                  console.warn(
                    'Hero Placeholder URL missing description:',
                    placeholderUrl,
                  );
                  slide.image.src = FALLBACK_IMAGE_URL;
                }
              } catch (error) {
                console.error(
                  'Error processing Hero Section placeholder:',
                  placeholderUrl,
                  error,
                );
                slide.image.src = FALLBACK_IMAGE_URL;
              }
            };

            // Handle single or multi-slide structure
            if (Array.isArray(section.data?.slides)) {
              console.log(
                `Processing HeroSection (Multi-slide) in path: ${pathKey}`,
              );
              for (const slide of section.data.slides) {
                await processSlide(slide);
              }
            } else if (section.data?.image) {
              console.log(
                `Processing HeroSection (Single-slide) in path: ${pathKey}`,
              );
              await processSlide(section.data);
            } else {
              console.warn(
                'HeroSection structure mismatch (expected slides array or image object):',
                section.data,
              );
            }
          }
          // --- OTHER SECTION PROCESSING (e.g., FeatureSection - future) ---
          // else if (section && section.id === 'FeatureSection') { ... }
        }
      }
    }
  }

  if (Array.isArray(json.products)) {
    for (const product of json.products) {
      if (
        product &&
        typeof product.imageUrl === 'string' &&
        product.imageUrl.startsWith('https://yns.img?description=')
      ) {
        totalPlaceholders++;
        const placeholderUrl = product.imageUrl;
        try {
          const url = new URL(placeholderUrl);
          const description = url.searchParams.get('description');

          if (description) {
            const bestMatchUrl = await findImageInDB(description, 'product');

            if (bestMatchUrl) {
              product.imageUrl = bestMatchUrl;
              successfulMatches++;
              console.log(
                `Product Image Match: Replaced placeholder for "${product.name || 'Unknown'}" with ${bestMatchUrl}`,
              );
            } else {
              product.imageUrl = FALLBACK_IMAGE_URL;
              console.warn(
                `Product Image Match: No suitable image found for "${product.name || 'Unknown'}" (Desc: "${description}"). Using fallback.`,
              );
            }
          } else {
            console.warn(
              'Product Placeholder URL missing description:',
              placeholderUrl,
            );
            product.imageUrl = FALLBACK_IMAGE_URL;
          }
        } catch (error) {
          console.error(
            'Error processing Product placeholder:',
            placeholderUrl,
            error,
          );
          product.imageUrl = FALLBACK_IMAGE_URL;
        }
      }
    }
  }

  // Log overall statistics
  if (totalPlaceholders > 0) {
    const successRate = ((successfulMatches / totalPlaceholders) * 100).toFixed(
      2,
    );
    console.log(
      `Image Placeholder Stats: Processed=${totalPlaceholders}, Matched=${successfulMatches}, Success Rate=${successRate}%`,
    );
  } else {
    console.log('Image Placeholder Stats: No placeholders found to process.');
  }

  return json;
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

    // --- Replace Image Placeholders ---
    console.log('Replacing image placeholders...');
    const startTimeReplace = Date.now();
    const finalJson = await replaceImagePlaceholders(generatedJson);
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
        body: JSON.stringify(finalJson), // Send the JSON with replaced image URLs
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

      // Return the YNS store URL, the *final* JSON (with replaced images), and generation times
      return NextResponse.json({
        storeUrl: ynsResult.url,
        storeJson: finalJson, // Return the modified JSON
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
    if (!pool && (error as Error).message.includes('database pool')) {
      return NextResponse.json(
        {
          error:
            'Internal Server Error: Database connection failed on startup.',
        },
        { status: 500 },
      );
    }
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
