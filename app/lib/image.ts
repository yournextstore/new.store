/**
 * @file app/lib/image.ts
 * @description This module handles all logic related to image processing for the AI-generated store content.
 * This includes defining constants for image similarity search, querying the database for existing images
 * based on descriptions, and replacing placeholder image URLs in the AI-generated JSON with actual image URLs.
 * It may also coordinate with image generation services if stock images are not found or if generation is explicitly requested.
 */

import { openai } from '@ai-sdk/openai';
import { pool } from '@/lib/db';
import { embed } from 'ai';
import {
  generateAndUploadPlaceholders,
  processSinglePlaceholder,
} from './image-generation'; // Assuming image-generation.ts is in the same app/lib directory
import type { GenerationMode } from './image-generation';

// --- Constants & Types ---
const EMBEDDING_MODEL = openai.embedding('text-embedding-3-small');
const SIMILARITY_THRESHOLD = 0.45; // Adjust as needed
const FALLBACK_IMAGE_URL = 'https://via.placeholder.com/300'; // Use a generic placeholder URL if no match found
const COSINE_DISTANCE_THRESHOLD = 1 - SIMILARITY_THRESHOLD; // pgvector uses distance

// --- Database Query Function ---
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
          console.log(
            `DB Hero Match (Type+Align+Thresh): Found ${bestMatchUrl} for alignment ${alignment}`,
          );
        } else {
          // Query 2: Image Type + Alignment Only (Fallback 1)
          console.log(
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
            console.log(
              `DB Hero Match (Type+Align Only): Found ${bestMatchUrl} for alignment ${alignment}`,
            );
          } else {
            console.log(
              `DB Hero Fallback 2: No match found for type "${imageType}" alignment "${alignment}".`,
            );
            // Fallback 3: Maybe just find *any* hero image matching description?
            // Consider adding another fallback layer if needed.
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
          console.log(`DB Product Match: Found ${bestMatchUrl}`);
        } else {
          console.log(
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
): Promise<any> {
  const rootStartTime = Date.now(); // Establish the root start time here
  const logWithTime = (message: string) => {
    const elapsed = Date.now() - rootStartTime;
    console.log(`[T+${elapsed}ms] ${message}`);
  };

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
    logWithTime('No image placeholders found to process.');
    return json;
  }

  logWithTime(
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
        logWithTime(
          `[Stock Mode] ${imageType} Image Request: Align "${alignmentForGeneration ?? 'N/A'}", Desc: "${description.substring(0, 50)}..."`,
        );
        const stockMatchUrl = await findImageInDB(
          description,
          imageType,
          alignmentForDbLookup, // This is 'left' | 'right' | undefined
        );
        if (stockMatchUrl) {
          targetObject[targetKey] = stockMatchUrl;
          successfulMatches++;
          logWithTime(
            `[Stock Mode] ${imageType} Image Match: Replaced for "${description.substring(0, 30)}..." with ${stockMatchUrl}`,
          );
        } else {
          targetObject[targetKey] = FALLBACK_IMAGE_URL;
          logWithTime(
            `[Stock Mode] ${imageType} Fallback (Stock): No DB match for "${description.substring(0, 30)}...". Using fallback.`,
          );
        }
      } else {
        // --- GENERATE MODE ---
        if (imageType === 'hero') heroGenerationAttempted++;
        else productGenerationAttempted++;

        logWithTime(
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
            rootStartTime,
          );

          if (generationResult?.blobUrl) {
            targetObject[targetKey] = generationResult.blobUrl;
            if (imageType === 'hero') heroGenerationSucceeded++;
            else productGenerationSucceeded++;
            logWithTime(
              `[Generate Mode - ${imageMode}] ${imageType} Image Success: Replaced for "${description.substring(0, 30)}..." with ${generationResult.blobUrl}`,
            );
          } else {
            // Generation failed
            logWithTime(
              `[Generate Mode - ${imageMode}] ${imageType} Generation Failed for "${description.substring(0, 30)}...". Attempting stock fallback if hero.`,
            );
            if (imageType === 'hero') {
              const stockFallbackUrl = await findImageInDB(
                description,
                'hero',
                alignmentForDbLookup,
              );
              if (stockFallbackUrl) {
                targetObject[targetKey] = stockFallbackUrl;
                // successfulMatches++; // Optionally count this as a "successful recovery"
                logWithTime(
                  `[Generate Mode - ${imageMode}] Hero Stock Fallback Success: Used ${stockFallbackUrl}`,
                );
              } else {
                targetObject[targetKey] = FALLBACK_IMAGE_URL;
                logWithTime(
                  `[Generate Mode - ${imageMode}] Hero Stock Fallback Failed. Using final fallback URL.`,
                );
              }
            } else {
              // Product generation failed, no further fallback
              targetObject[targetKey] = FALLBACK_IMAGE_URL;
              logWithTime(
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
  logWithTime(
    `Finished processing all ${imageOperations.length} image operations.`,
  );

  // --- Log Statistics ---
  if (totalPlaceholders > 0) {
    logWithTime('--- Image Placeholder Stats ---');
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

  logWithTime('Returning final JSON');
  return json;
}
