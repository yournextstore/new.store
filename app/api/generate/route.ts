import { NextResponse } from 'next/server';
import { generateText, cosineSimilarity, embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import fs from 'node:fs/promises';
import path from 'node:path';

// --- Constants & Types ---
const IMAGE_LIBRARY_PATH = path.join(
  process.cwd(),
  'data',
  'lib',
  'image-library.json',
);
const EMBEDDING_MODEL = openai.embedding('text-embedding-3-small');
const SIMILARITY_THRESHOLD = 0.45; // Adjust as needed
const FALLBACK_IMAGE_URL = 'https://via.placeholder.com/300'; // Use a generic placeholder URL if no match found

interface LibraryImageData {
  path: string;
  url: string; // Vercel Blob URL
  description: string;
  shortName: string;
  embedding: number[];
}

// --- Load Image Library Data (Load once, reuse if possible in server context) ---
let imageLibrary: LibraryImageData[] = [];
async function loadImageLibrary() {
  if (imageLibrary.length === 0) {
    try {
      console.log(`Loading image library from: ${IMAGE_LIBRARY_PATH}`);
      const fileContent = await fs.readFile(IMAGE_LIBRARY_PATH, 'utf-8');
      imageLibrary = JSON.parse(fileContent);
      console.log(`Loaded ${imageLibrary.length} images into library.`);
    } catch (error) {
      console.error('Failed to load image library:', error);
      // Decide how to handle this - throw error, or continue without image replacement?
      // For now, we'll log and potentially continue, resulting in placeholders being sent.
      imageLibrary = []; // Ensure it's empty on failure
    }
  }
  return imageLibrary;
}

// --- Image Placeholder Replacement Logic ---
async function replaceImagePlaceholders(json: any): Promise<any> {
  const library = await loadImageLibrary();
  let totalPlaceholders = 0;
  let successfulMatches = 0;

  if (!library || library.length === 0) {
    console.warn(
      'Image library not loaded or empty. Skipping image replacement.',
    );
    return json; // Return original JSON if library isn't available
  }

  if (!json || typeof json !== 'object') return json; // Basic type check

  // Filter library into subsets
  const productLibrary = library.filter((item) =>
    item.path.includes('/products/'),
  );
  const heroLibrary = library.filter((item) => item.path.includes('-hero-'));

  console.log(
    `Filtered libraries: ${productLibrary.length} product images, ${heroLibrary.length} hero images.`,
  );

  // Helper function for finding the best match
  async function findBestMatch(
    description: string,
    targetLibrary: LibraryImageData[],
    options: {
      threshold?: number;
      alignment?: 'left' | 'right' | null;
      applyThreshold: boolean; // Flag to control threshold application
    },
  ): Promise<LibraryImageData | null> {
    if (!description || targetLibrary.length === 0) return null;

    try {
      const { embedding } = await embed({
        model: EMBEDDING_MODEL,
        value: description,
      });

      let bestMatchItem: LibraryImageData | null = null;
      let highestSimilarity = -1;

      for (const item of targetLibrary) {
        if (
          item.embedding &&
          Array.isArray(item.embedding) &&
          item.embedding.length > 0
        ) {
          // 1. Check alignment if required
          if (options.alignment) {
            const requiredSuffix = `-${options.alignment}.`; // e.g., -left.
            if (!item.path.includes(requiredSuffix)) {
              continue; // Skip if alignment doesn't match
            }
          }

          // 2. Calculate similarity
          const similarity = cosineSimilarity(embedding, item.embedding);

          // 3. Check threshold if required
          if (
            options.applyThreshold &&
            similarity < (options.threshold ?? -1)
          ) {
            continue; // Skip if below threshold and threshold is applied
          }

          // 4. Update best match if this one is better
          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatchItem = item;
          }
        } else {
          console.warn(
            `Skipping library item due to invalid embedding: ${item.url} `,
          );
        }
      }

      // Log results (optional, can be refined)
      if (bestMatchItem) {
        console.log(
          `Match found for description: "${description}" (Similarity: ${highestSimilarity.toFixed(4)}, Alignment: ${options.alignment ?? 'N/A'}, Threshold Applied: ${options.applyThreshold}). Selected: ${bestMatchItem.url}`,
        );
      } else {
        console.log(
          `No suitable match found for description: "${description}" (Alignment: ${options.alignment ?? 'N/A'}, Threshold Applied: ${options.applyThreshold})`,
        );
      }

      return bestMatchItem;
    } catch (error) {
      console.error('Error during embedding or similarity search:', error);
      return null;
    }
  }

  // --- Process Sections (including Hero) ---
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

                if (description && heroLibrary.length > 0) {
                  totalPlaceholders++;
                  let finalMatchItem: LibraryImageData | null = null;

                  // Attempt 1: Find best match with alignment and threshold
                  finalMatchItem = await findBestMatch(
                    description,
                    heroLibrary,
                    {
                      alignment,
                      threshold: SIMILARITY_THRESHOLD,
                      applyThreshold: true,
                    },
                  );

                  // Attempt 2 (Fallback 1): Find best match with alignment, ignoring threshold
                  if (!finalMatchItem) {
                    console.log(
                      `Hero Fallback 1: Searching for alignment "${alignment}" without threshold...`,
                    );
                    finalMatchItem = await findBestMatch(
                      description,
                      heroLibrary,
                      {
                        alignment,
                        applyThreshold: false,
                      },
                    );
                  }

                  // Apply result or final fallback
                  if (finalMatchItem) {
                    slide.image.src = finalMatchItem.url;
                    successfulMatches++;
                    console.log(
                      `Hero Image Match: Replaced placeholder for alignment "${alignment}" with ${finalMatchItem.url}`,
                    );
                  } else {
                    // Fallback 2: Use generic placeholder if no alignment match found at all
                    slide.image.src = FALLBACK_IMAGE_URL;
                    console.warn(
                      `Hero Fallback 2: No image found matching alignment "${alignment}" for description "${description}". Using fallback URL.`,
                    );
                  }
                } else if (!description) {
                  console.warn(
                    'Hero Placeholder URL missing description:',
                    placeholderUrl,
                  );
                  slide.image.src = FALLBACK_IMAGE_URL;
                } else {
                  console.warn(
                    'Hero library is empty, cannot process placeholder:',
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
              await Promise.all(section.data.slides.map(processSlide));
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

  // --- Process product images ---
  if (Array.isArray(json.products) && productLibrary.length > 0) {
    const productPlaceholders = json.products.filter(
      (p: any) =>
        p &&
        typeof p.imageUrl === 'string' &&
        p.imageUrl.startsWith('https://yns.img?description='),
    );
    totalPlaceholders += productPlaceholders.length;

    for (const product of json.products) {
      if (
        product &&
        typeof product.imageUrl === 'string' &&
        product.imageUrl.startsWith('https://yns.img?description=')
      ) {
        const placeholderUrl = product.imageUrl;
        try {
          const url = new URL(placeholderUrl);
          const description = url.searchParams.get('description');

          if (description) {
            const bestMatchItem = await findBestMatch(
              description,
              productLibrary,
              {
                threshold: SIMILARITY_THRESHOLD,
                applyThreshold: true, // Threshold is strict for products
                alignment: null, // No alignment needed for products
              },
            );

            if (bestMatchItem) {
              product.imageUrl = bestMatchItem.url;
              successfulMatches++;
              console.log(
                `Product Image Match: Replaced placeholder for "${product.name || 'Unknown'}" with ${bestMatchItem.url}`,
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
  } else if (Array.isArray(json.products) && productLibrary.length === 0) {
    console.warn(
      'Product library is empty, cannot process product image placeholders.',
    );
    // Optionally set all product placeholders to fallback
    json.products.forEach((p: any) => {
      if (
        p &&
        typeof p.imageUrl === 'string' &&
        p.imageUrl.startsWith('https://yns.img?description=')
      ) {
        p.imageUrl = FALLBACK_IMAGE_URL;
      }
    });
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
    // Ensure library is loaded on first request (or potentially earlier in a server context)
    await loadImageLibrary();

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
    const ynsApiUrl = `${process.env.YNS_API_URL}/admin/ai-test/import?userId=${userId}`;
    console.log(`Calling YNS API: ${ynsApiUrl}`);
    const ynsApiKey = process.env.YNS_AI_API_KEY;

    if (!ynsApiKey) {
      console.error('YNS_AI_API_KEY environment variable is not set.');
      return NextResponse.json(
        { error: 'Internal Server Error: API key configuration missing.' },
        { status: 500 },
      );
    }
    if (!process.env.YNS_API_URL) {
      console.error('YNS_API_URL environment variable is not set.');
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
    // Consider more specific error handling based on potential errors from generateText
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
