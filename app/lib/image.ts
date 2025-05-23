/**
 * @file app/lib/image.ts
 * @description This module handles all logic related to image processing for the AI-generated store content.
 * This includes defining constants for image similarity search, querying the database for existing images
 * based on descriptions, and replacing placeholder image URLs in the AI-generated JSON with actual image URLs.
 * It may also coordinate with image generation services if stock images are not found or if generation is explicitly requested.
 */

// import { openai } from '@ai-sdk/openai'; // To be removed
import { heliconeOpenAI } from './ai-providers'; // Import new provider
import { pool } from '@/lib/db';
import { embed } from 'ai';
import { processSinglePlaceholder } from './image-generation'; // Assuming image-generation.ts is in the same app/lib directory
import type { GenerationMode } from './image-generation';
import type { HeliconeRequestContext } from './request-context';

// --- Constants & Types ---
// TODO: If specific Helicone headers (e.g., user ID, session ID) are needed for embedding calls,
// consider how to propagate them to this point or if a generic set of headers is sufficient.
// For now, using heliconeOpenAI() without dynamic headers, relying on defaults in ai-providers.ts.
const EMBEDDING_MODEL = heliconeOpenAI().embedding('text-embedding-3-small');
// This constant defines WHICH embedding model to use via our Helicone-configured provider.
// The actual Helicone headers (static from ai-providers.ts and dynamic per call)
// are handled when `heliconeOpenAI()` is called or when `embed()` is called with options.

const SIMILARITY_THRESHOLD = 0.45; // Adjust as needed
const FALLBACK_IMAGE_URL = 'https://via.placeholder.com/300'; // Use a generic placeholder URL if no match found
const COSINE_DISTANCE_THRESHOLD = 1 - SIMILARITY_THRESHOLD; // pgvector uses distance

// --- Database Query Function ---
/**
 * Finds an image in the database based on a textual description and type,
 * optionally filtering by layout alignment for hero images.
 *
 * @param description - The textual description of the image to search for.
 *   Used to generate an embedding for similarity search.
 * @param imageType - Specifies the type of image to search for:
 *   - 'hero': Searches for hero images. Behavior is further modified by the `alignment` parameter.
 *   - 'product': Searches for product images. The `alignment` parameter is ignored.
 * @param alignment - Optional. For 'hero' images, specifies the desired layout alignment ('left' | 'right').
 *   - If provided for a 'hero' image, the search prioritizes images matching this `layout_hint`.
 *     It first looks for matches above a similarity threshold and then falls back to the best match
 *     for that alignment regardless of threshold.
 *   - If `undefined` (or not provided) for a 'hero' image, the function performs a broader search
 *     for the best semantically matching hero image based *only* on the description, ignoring `layout_hint`.
 *     This mode is suitable for fast previews where a specific alignment is not yet known or required.
 *   - This parameter is ignored if `imageType` is 'product'.
 * @param heliconeContext - Optional. Context for Helicone logging, including user and session identifiers.
 * @param debugTopN - Optional. If true, and for hero images with no alignment, log the top 5 candidates with descriptions and scores, but still return only the best match.
 * @returns A `Promise` that resolves to the `blob_url` (string) of the best-matching image, or `null` if no suitable image is found or an error occurs.
 */
export async function findImageInDB(
  description: string,
  imageType: 'hero' | 'product',
  alignment?: 'left' | 'right',
  heliconeContext?: HeliconeRequestContext,
  debugTopN = false,
): Promise<string | null> {
  if (!pool) {
    console.error('Database pool is not initialized. Cannot query images.');
    return null;
  }
  if (!description) return null;

  let bestMatchUrl: string | null = null;

  try {
    const perCallHeaders: Record<string, string> = {};
    if (heliconeContext?.userId)
      perCallHeaders['Helicone-User-Id'] = heliconeContext.userId;
    if (heliconeContext?.userEmail)
      perCallHeaders['Helicone-Property-user-email'] =
        heliconeContext.userEmail;
    if (heliconeContext?.vercelRequestId)
      perCallHeaders['Helicone-Session-Id'] = heliconeContext.vercelRequestId;

    const { embedding } = await embed({
      model: EMBEDDING_MODEL,
      value: description,
      headers: perCallHeaders,
    });

    // Format the embedding array into the string format pgvector expects
    const embeddingString = JSON.stringify(embedding);

    const client = await pool.connect(); // Get connection from pool

    try {
      if (imageType === 'hero') {
        // If alignment is provided, use the existing logic with alignment
        if (alignment) {
          // Query 1: Image Type + Alignment + Threshold
          const query1 = `
            SELECT blob_url
            FROM images
            WHERE image_type = $1 -- Use explicit type column
              AND layout_hint = $2
              AND source = 'static' -- Ensure it's from the library build
              AND embedding <=> $3::vector < $4
            ORDER BY embedding <=> $3::vector ASC
            LIMIT 1;
          `;
          const result1 = await client.query(query1, [
            imageType, // Pass 'hero'
            alignment,
            embeddingString,
            COSINE_DISTANCE_THRESHOLD,
          ]);

          if (result1.rows.length > 0) {
            bestMatchUrl = result1.rows[0].blob_url;
            console.debug(
              `DB Hero Match (Type+Align+Thresh): Found ${bestMatchUrl} for alignment ${alignment}`,
            );
          } else {
            // Query 2: Image Type + Alignment Only (Fallback 1)
            console.debug(
              `DB Hero Fallback 1: Searching type "${imageType}" alignment "${alignment}" without threshold...`,
            );
            const query2 = `
              SELECT blob_url
              FROM images
              WHERE image_type = $1 -- Use explicit type column
                AND layout_hint = $2
                AND source = 'static' -- Ensure it's from the library build
              ORDER BY embedding <=> $3::vector ASC
              LIMIT 1;
            `;
            const result2 = await client.query(query2, [
              imageType, // Pass 'hero'
              alignment,
              embeddingString,
            ]);
            if (result2.rows.length > 0) {
              bestMatchUrl = result2.rows[0].blob_url;
              console.debug(
                `DB Hero Match (Type+Align Only): Found ${bestMatchUrl} for alignment ${alignment}`,
              );
            } else {
              console.debug(
                `DB Hero Fallback 2: No match found for type "${imageType}" alignment "${alignment}".`,
              );
              // Fallback 3: Consider finding *any* hero image matching description IF alignment was specified but no match found.
              // This could be another query here, or a decision to let it return null.
            }
          }
        } else {
          // No alignment provided (e.g., for fast Turn 1 preview)
          // Query for best hero image based on description only, ignoring layout_hint and threshold for speed.
          console.debug(
            `DB Hero (No Align): Searching type "${imageType}" by description only...`,
          );
          const queryNoAlign = `
            SELECT
              blob_url,
              description AS image_description,  -- Select description for debugging
              embedding <=> $2::vector AS distance -- Select distance for debugging
            FROM images
            WHERE image_type = $1 -- Use explicit type column
            ORDER BY distance ASC
            LIMIT ${debugTopN ? 5 : 1}; -- Fetch 5 if debugging, else 1
          `;
          const resultNoAlign = await client.query(queryNoAlign, [
            imageType, // Pass 'hero'
            embeddingString,
          ]);

          if (debugTopN && resultNoAlign.rows.length > 0) {
            console.debug(
              `[DEBUG Hero Lookup Top 5 for "${description.substring(0, 50)}..."]`,
            );
            resultNoAlign.rows.forEach((row, index) => {
              console.debug(
                `  ${index + 1}. URL: ${row.blob_url}, Desc: "${row.image_description}", Distance: ${row.distance}`,
              );
            });
          }

          if (resultNoAlign.rows.length > 0) {
            bestMatchUrl = resultNoAlign.rows[0].blob_url; // Still return only the top one
            console.debug(`DB Hero Match (No Align): Found ${bestMatchUrl}`);
          } else {
            console.debug(
              `DB Hero Match (No Align): No hero image found for description "${description.substring(0, 50)}..."`,
            );
          }
        }
      } else if (imageType === 'product') {
        const query = `
          SELECT blob_url
          FROM images
          WHERE image_type = $1 -- Use explicit type column
            AND source = 'static' -- Ensure it's from the library build
            AND embedding <=> $2::vector < $3
          ORDER BY embedding <=> $2::vector ASC
          LIMIT 1;
        `;
        const result = await client.query(query, [
          imageType, // Pass 'product'
          embeddingString,
          COSINE_DISTANCE_THRESHOLD,
        ]);
        if (result.rows.length > 0) {
          bestMatchUrl = result.rows[0].blob_url;
          console.debug(`DB Product Match: Found ${bestMatchUrl}`);
        } else {
          console.debug(
            `DB Product Match: No suitable match found below threshold for description "${description.substring(0, 50)}..."`,
          );
          // Consider fallback for products too? (e.g., ignore threshold)
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

// --- Types for Unified Image Processing ---
interface ImageOperation {
  targetObject: any; // The JSON object to update (e.g., slide.image or product)
  targetKey: string; // The key for the image URL (e.g., 'src' or 'imageUrl')
  description: string;
  imageType: 'hero' | 'product';
  // Hero-specific
  alignmentForDbLookup?: 'left' | 'right';
  alignmentForGeneration?: 'left' | 'right' | 'center';
  // Generation-specific
  originalUrl?: string; // Placeholder URL for generation context
}
// --- End Types ---

/**
 * Recursively traverses a JSON object/array and replaces image placeholder URLs
 * (matching `https://yns.img?description=...`) with URLs found via DB similarity search or generation.
 * Handles different image types (product, hero) and alignment requirements concurrently.
 * @param json The JSON data (or sub-part) to process.
 * @param imageMode Determines the source for PRODUCT images ('stock' or a generation API identifier).
 * @param imageStyle The image style (general style for product images consistent with the store concept).
 * @returns The modified JSON data.
 */
export async function replaceImagePlaceholders(
  json: any,
  imageMode: GenerationMode,
  imageStyle?: string | null,
  heliconeContext?: HeliconeRequestContext,
): Promise<any> {
  if (!pool) {
    console.warn('Database pool not available. Skipping image replacement.');
    return json;
  }
  if (!json || typeof json !== 'object') return json;

  const imageOperations: ImageOperation[] = [];
  let totalPlaceholders = 0;
  let successfulMatches = 0; // Primarily for stock mode successes or successful fallbacks from generation
  let heroGenerationAttempted = 0;
  let heroGenerationSucceeded = 0;
  let productGenerationAttempted = 0;
  let productGenerationSucceeded = 0;

  // --- Collect Hero Image Operations ---
  if (json.paths && typeof json.paths === 'object') {
    for (const pathKey in json.paths) {
      if (Array.isArray(json.paths[pathKey])) {
        for (const section of json.paths[pathKey]) {
          if (section && section.id === 'HeroSection') {
            const collectHeroOps = (slide: any) => {
              if (
                !slide?.image ||
                typeof slide.image.src !== 'string' ||
                !slide.image.src.startsWith('https://yns.img?description=')
              ) {
                return;
              }

              const placeholderUrl = slide.image.src;
              try {
                const url = new URL(placeholderUrl);
                const description = url.searchParams.get('description');
                if (!description) {
                  console.warn(
                    'Hero Placeholder URL missing description:',
                    placeholderUrl,
                  );
                  slide.image.src = FALLBACK_IMAGE_URL; // Set fallback immediately if no description
                  return;
                }

                let alignmentForDbLookup: 'left' | 'right' | undefined =
                  undefined;
                let alignmentForGeneration: 'left' | 'right' | 'center' =
                  'left';
                const rawAlignment = slide.data?.boxAlignment?.toLowerCase();
                if (rawAlignment === 'right') {
                  alignmentForDbLookup = 'right';
                  alignmentForGeneration = 'right';
                } else if (rawAlignment === 'left') {
                  alignmentForDbLookup = 'left';
                  alignmentForGeneration = 'left';
                } else if (rawAlignment === 'center') {
                  alignmentForGeneration = 'center';
                }

                imageOperations.push({
                  targetObject: slide.image,
                  targetKey: 'src',
                  description,
                  imageType: 'hero',
                  alignmentForDbLookup,
                  alignmentForGeneration,
                  originalUrl: placeholderUrl,
                });
              } catch (error) {
                console.error(
                  'Error preparing Hero Section placeholder for processing:',
                  placeholderUrl,
                  error,
                );
                slide.image.src = FALLBACK_IMAGE_URL;
              }
            };

            if (Array.isArray(section.data?.slides)) {
              section.data.slides.forEach(collectHeroOps);
            } else if (section.data?.image) {
              collectHeroOps(section.data);
            }
          }
          // --- OTHER SECTION PROCESSING (e.g., FeatureSection - future) ---
        }
      }
    }
  }

  // --- Collect Product Image Operations ---
  if (Array.isArray(json.products)) {
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
          if (!description) {
            console.warn(
              'Product Placeholder URL missing description:',
              placeholderUrl,
            );
            product.imageUrl = FALLBACK_IMAGE_URL; // Set fallback immediately
            continue;
          }
          imageOperations.push({
            targetObject: product,
            targetKey: 'imageUrl',
            description,
            imageType: 'product',
            originalUrl: placeholderUrl,
          });
        } catch (error) {
          console.error(
            'Error preparing Product placeholder for processing:',
            placeholderUrl,
            error,
          );
          product.imageUrl = FALLBACK_IMAGE_URL;
        }
      }
    }
  }

  if (imageOperations.length === 0) {
    console.log('No image placeholders found to process.');
    return json;
  }

  console.log(
    `Collected ${imageOperations.length} image operations. Starting processing...`,
  );

  // --- Process All Image Operations Concurrently ---
  const processingPromises = imageOperations.map(async (operation) => {
    totalPlaceholders++;
    const {
      targetObject,
      targetKey,
      description,
      imageType,
      alignmentForDbLookup,
      alignmentForGeneration,
      originalUrl,
    } = operation;

    try {
      if (imageMode === 'stock') {
        // --- STOCK MODE ---
        console.debug(
          `[Stock Mode] ${imageType} Image Request: Align "${alignmentForGeneration ?? 'N/A'}", Desc: "${description.substring(0, 50)}..."`,
        );
        const stockMatchUrl = await findImageInDB(
          description,
          imageType,
          alignmentForDbLookup, // This is 'left' | 'right' | undefined
          heliconeContext,
        );
        if (stockMatchUrl) {
          targetObject[targetKey] = stockMatchUrl;
          successfulMatches++;
          console.debug(
            `[Stock Mode] ${imageType} Image Match: Replaced for "${description.substring(0, 30)}..." with ${stockMatchUrl}`,
          );
        } else {
          targetObject[targetKey] = FALLBACK_IMAGE_URL;
          console.warn(
            `[Stock Mode] ${imageType} Fallback (Stock): No DB match for "${description.substring(0, 30)}...". Using fallback.`,
          );
        }
      } else {
        // --- GENERATE MODE ---
        if (imageType === 'hero') heroGenerationAttempted++;
        else productGenerationAttempted++;

        console.debug(
          `[Generate Mode - ${imageMode}] ${imageType} Image Request: Align "${alignmentForGeneration ?? 'N/A'}", Desc: "${description.substring(0, 50)}..."`,
        );

        if (!originalUrl) {
          // This should ideally not happen for generation mode if collection phase is correct
          console.error(
            `[Generate Mode - ${imageMode}] CRITICAL: originalUrl is missing for ${imageType} (Desc: "${description.substring(0, 50)}..."). Using fallback for targetObject.`,
          );
          targetObject[targetKey] = FALLBACK_IMAGE_URL;
          // Skip processSinglePlaceholder call as it requires originalUrl
        } else {
          const generationResult = await processSinglePlaceholder(
            { originalUrl: originalUrl, description }, // originalUrl is now guaranteed by the check above
            imageMode,
            imageType,
            alignmentForGeneration, // This is 'left' | 'right' | 'center' for heroes
            imageType === 'product' ? imageStyle : null, // imageStyle only for products
            heliconeContext,
          );

          if (generationResult?.blobUrl) {
            targetObject[targetKey] = generationResult.blobUrl;
            if (imageType === 'hero') heroGenerationSucceeded++;
            else productGenerationSucceeded++;
            console.debug(
              `[Generate Mode - ${imageMode}] ${imageType} Image Success: Replaced for "${description.substring(0, 30)}..." with ${generationResult.blobUrl}`,
            );
          } else {
            // Generation failed
            console.warn(
              `[Generate Mode - ${imageMode}] ${imageType} Generation Failed for "${description.substring(0, 30)}...". Attempting stock fallback if hero.`,
            );
            if (imageType === 'hero') {
              const stockFallbackUrl = await findImageInDB(
                description,
                'hero',
                alignmentForDbLookup,
                heliconeContext,
              );
              if (stockFallbackUrl) {
                targetObject[targetKey] = stockFallbackUrl;
                // successfulMatches++; // Optionally count this as a "successful recovery"
                console.info(
                  `[Generate Mode - ${imageMode}] Hero Stock Fallback Success: Used ${stockFallbackUrl}`,
                );
              } else {
                targetObject[targetKey] = FALLBACK_IMAGE_URL;
                console.warn(
                  `[Generate Mode - ${imageMode}] Hero Stock Fallback Failed. Using final fallback URL.`,
                );
              }
            } else {
              // Product generation failed, no further fallback
              targetObject[targetKey] = FALLBACK_IMAGE_URL;
              console.warn(
                `[Generate Mode - ${imageMode}] Product using fallback URL after generation failure.`,
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `Error processing ${imageType} placeholder (Desc: "${description.substring(0, 50)}...") :`,
        error,
      );
      targetObject[targetKey] = FALLBACK_IMAGE_URL;
    }
  });

  await Promise.allSettled(processingPromises);
  console.log(
    `Finished processing all ${imageOperations.length} image operations.`,
  );

  // --- Log Statistics ---
  if (totalPlaceholders > 0) {
    console.log('--- Image Placeholder Stats ---');
    console.log(`Total Placeholders Processed: ${totalPlaceholders}`);

    if (imageMode !== 'stock') {
      // More detailed stats for generation mode
      const stockLookupsForGenerationFallbacks = successfulMatches; // Assuming successfulMatches is only incremented on stock success
      console.log(
        `  Stock DB Lookups (Actual in Stock Mode, or Fallbacks in Gen Mode): Matched=${stockLookupsForGenerationFallbacks}`,
      );
      if (heroGenerationAttempted > 0) {
        console.log(
          `  Generation (Hero):      Attempted=${heroGenerationAttempted}, Succeeded=${heroGenerationSucceeded}`,
        );
      }
      if (productGenerationAttempted > 0) {
        console.log(
          `  Generation (Product):   Attempted=${productGenerationAttempted}, Succeeded=${productGenerationSucceeded}`,
        );
      }
      const totalGeneratedSuccessfully =
        heroGenerationSucceeded + productGenerationSucceeded;
      const totalAttemptedGeneration =
        heroGenerationAttempted + productGenerationAttempted;
      if (totalAttemptedGeneration > 0) {
        const generationSuccessRate = (
          (totalGeneratedSuccessfully / totalAttemptedGeneration) *
          100
        ).toFixed(2);
        console.log(
          `  Overall Generation Success Rate: ${generationSuccessRate}% (${totalGeneratedSuccessfully}/${totalAttemptedGeneration})`,
        );
      }
    } else {
      // Simpler stats for pure stock mode
      const successRate =
        successfulMatches > 0 && totalPlaceholders > 0
          ? ((successfulMatches / totalPlaceholders) * 100).toFixed(2)
          : '0.00';
      console.log(
        `  DB Lookups (Stock Mode): Matched=${successfulMatches} / ${totalPlaceholders} (${successRate}%)`,
      );
    }
    console.log('-----------------------------');
  } else {
    // This case is handled earlier, but kept for safety, though logWithTime might not be defined if no ops.
    // console.log('Image Placeholder Stats: No placeholders found to process.');
  }

  console.log('Returning final JSON');
  return json;
}
