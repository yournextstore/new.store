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

/**
 * Recursively traverses a JSON object/array and replaces image placeholder URLs
 * (matching `https://yns.img?description=...`) with URLs found via DB similarity search or generation.
 * Handles different image types (product, hero) and alignment requirements.
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
  const startTime = Date.now();
  const logWithTime = (message: string) => {
    const elapsed = Date.now() - startTime;
    console.log(`[${elapsed}ms] ${message}`);
  };

  let totalPlaceholders = 0;
  let successfulMatches = 0;
  // Separate counters for stats
  let heroGenerationAttempted = 0;
  let heroGenerationSucceeded = 0;
  let productGenerationAttempted = 0;
  let productGenerationSucceeded = 0;
  const productPlaceholdersToGenerate: {
    originalUrl: string;
    description: string;
    productRef: any;
  }[] = [];

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

              let alignmentForDbLookup: 'left' | 'right' | undefined =
                undefined; // For findImageInDB
              let alignmentForGeneration: 'left' | 'right' | 'center' = 'left'; // For processSinglePlaceholder

              const rawAlignment = slide.data?.boxAlignment?.toLowerCase();
              if (rawAlignment === 'right') {
                alignmentForDbLookup = 'right';
                alignmentForGeneration = 'right';
              } else if (rawAlignment === 'left') {
                alignmentForDbLookup = 'left';
                alignmentForGeneration = 'left';
              } else if (rawAlignment === 'center') {
                // findImageInDB doesn't support 'center', so lookup is undefined
                // generation prompt *will* use 'center'
                alignmentForGeneration = 'center';
              }

              try {
                const url = new URL(placeholderUrl);
                const description = url.searchParams.get('description');

                if (description) {
                  totalPlaceholders++; // Count all valid placeholders

                  if (imageMode === 'stock') {
                    // --- STOCK MODE (Existing DB Lookup for Heroes) ---
                    console.log(
                      `[Stock Mode] Hero Image Request: Align "${alignmentForGeneration}", Desc: "${description.substring(0, 50)}..."`,
                    );
                    const stockMatchUrl = await findImageInDB(
                      description,
                      'hero',
                      alignmentForDbLookup,
                    );
                    if (stockMatchUrl) {
                      slide.image.src = stockMatchUrl;
                      successfulMatches++;
                      console.log(
                        `[Stock Mode] Hero Image Match: Replaced placeholder for alignment "${alignmentForGeneration}" with ${stockMatchUrl}`,
                      );
                    } else {
                      slide.image.src = FALLBACK_IMAGE_URL;
                      console.warn(
                        `[Stock Mode] Hero Fallback (Stock): No DB match for alignment "${alignmentForGeneration}". Using fallback.`,
                      );
                    }
                  } else {
                    // --- GENERATE MODE for Heroes ---
                    heroGenerationAttempted++;
                    console.log(
                      `[Generate Mode - ${imageMode}] Hero Image Request: Align "${alignmentForGeneration}", Desc: "${description.substring(0, 50)}..."`,
                    );
                    // Call processSinglePlaceholder directly for hero images
                    const result = await processSinglePlaceholder(
                      { originalUrl: placeholderUrl, description },
                      imageMode, // Pass the selected generationMode
                      'hero',
                      alignmentForGeneration, // This is 'left' | 'right' | 'center'
                      // imageStyle is not used for heroes based on prior discussion
                      null,
                    );

                    if (result?.blobUrl) {
                      slide.image.src = result.blobUrl;
                      heroGenerationSucceeded++;
                      console.log(
                        `[Generate Mode - ${imageMode}] Hero Image Success: Replaced placeholder for alignment "${alignmentForGeneration}" with ${result.blobUrl}`,
                      );
                    } else {
                      console.warn(
                        `[Generate Mode - ${imageMode}] Hero Generation Failed for alignment "${alignmentForGeneration}". Attempting stock fallback.`,
                      );
                      // Fallback to stock image search
                      const stockFallbackUrl = await findImageInDB(
                        description,
                        'hero',
                        alignmentForDbLookup,
                      );
                      if (stockFallbackUrl) {
                        slide.image.src = stockFallbackUrl;
                        // Note: generationAttempted was already incremented. We don't count this as a generationSucceeded.
                        console.log(
                          `[Generate Mode - ${imageMode}] Hero Stock Fallback Success: Used ${stockFallbackUrl}`,
                        );
                      } else {
                        slide.image.src = FALLBACK_IMAGE_URL;
                        console.warn(
                          `[Generate Mode - ${imageMode}] Hero Stock Fallback Failed for alignment "${alignmentForGeneration}". Using final fallback URL.`,
                        );
                      }
                    }
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
              const slidePromises = section.data.slides.map(processSlide);
              await Promise.allSettled(slidePromises); // Process slides concurrently
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
    logWithTime('Starting product processing');
    const productProcessingPromises: Promise<void>[] = []; // Store promises for concurrent execution

    for (const product of json.products) {
      if (
        product &&
        typeof product.imageUrl === 'string' &&
        product.imageUrl.startsWith('https://yns.img?description=')
      ) {
        const placeholderUrl = product.imageUrl;
        totalPlaceholders++; // Count all valid placeholders

        // Wrap processing in an async function for Promise.allSettled
        const processProduct = async () => {
          try {
            const url = new URL(placeholderUrl);
            const description = url.searchParams.get('description');

            if (!description) {
              console.warn(
                'Product Placeholder URL missing description:',
                placeholderUrl,
              );
              product.imageUrl = FALLBACK_IMAGE_URL;
              return; // Stop processing this product
            }

            // --- Conditional Image Handling ---
            if (imageMode !== 'stock') {
              // --- GENERATE PATH ---
              // Add to list for batch processing later
              productPlaceholdersToGenerate.push({
                originalUrl: placeholderUrl,
                description: description,
                productRef: product, // Keep reference to modify later
              });
              productGenerationAttempted++;
              logWithTime(
                `Added product to generation queue: ${description.substring(0, 50)}...`,
              );
              // NOTE: We don't set fallback URL here yet. It's done after all generation calls.
            } else {
              // --- STOCK PATH (Existing DB Lookup) ---
              console.log(
                `[Stock Mode] Product Image Request: "${description.substring(0, 70)}..."`,
              );
              const bestMatchUrl = await findImageInDB(description, 'product'); // Find in DB

              if (bestMatchUrl) {
                product.imageUrl = bestMatchUrl;
                successfulMatches++; // Increment for successful DB match
                console.log(
                  `[Stock Mode] Product Image Match: Replaced placeholder for "${product.name || 'Unknown'}" with ${bestMatchUrl}`,
                );
              } else {
                product.imageUrl = FALLBACK_IMAGE_URL;
                console.warn(
                  `[Stock Mode] Product Fallback: No DB match for "${product.name || 'Unknown'}" (Desc: "${description.substring(0, 70)}..."). Using fallback.`,
                );
              }
            }
            // --- End Conditional Image Handling ---
          } catch (error) {
            console.error(
              'Error processing Product placeholder:',
              placeholderUrl,
              error,
            );
            product.imageUrl = FALLBACK_IMAGE_URL; // Set fallback on error during processing
          }
        };
        productProcessingPromises.push(processProduct());
      }
    }
    // Wait for all product stock lookups/parsing to complete
    logWithTime('Waiting for all product processing promises to settle');
    await Promise.allSettled(productProcessingPromises);
    logWithTime(
      `Finished processing ${productPlaceholdersToGenerate.length} products for generation`,
    );

    // --- Execute Generation Calls (if any) ---
    if (productPlaceholdersToGenerate.length > 0) {
      logWithTime(
        `Starting batch generation of ${productPlaceholdersToGenerate.length} products`,
      );

      // Add Promise chain logging
      logWithTime('About to call generateAndUploadPlaceholders');

      // Force event loop to process any pending operations
      await new Promise((resolve) => setImmediate(resolve));
      logWithTime('Event loop processed before generation call');

      // Add detailed logging around the await
      logWithTime('Preparing to await generateAndUploadPlaceholders');
      const generationPromise = generateAndUploadPlaceholders(
        productPlaceholdersToGenerate,
        imageMode,
        imageStyle,
      );
      logWithTime('Promise created, about to await');
      const generationResults = await generationPromise;
      logWithTime(
        'Promise resolved, received results from generateAndUploadPlaceholders',
      );

      // Create a map for easy lookup of product references
      logWithTime('Creating product reference map');
      const productRefMap = new Map(
        productPlaceholdersToGenerate.map((item) => [
          item.originalUrl,
          item.productRef,
        ]),
      );
      logWithTime('Product reference map created');

      // Update the JSON with the results
      logWithTime('Starting to update product URLs in JSON');
      for (const result of generationResults) {
        const productRef = productRefMap.get(result.originalUrl);
        if (productRef) {
          productRef.imageUrl = result.blobUrl ?? FALLBACK_IMAGE_URL; // Use Blob URL or fallback
          if (!result.blobUrl) {
            console.warn(
              `[Generate Mode] Failed to generate/upload image for placeholder ${result.originalUrl}. Using fallback.`,
            );
          } else {
            productGenerationSucceeded++;
            logWithTime(
              `Updated product URL for ${result.originalUrl.substring(0, 50)}...`,
            );
          }
        } else {
          // This shouldn't happen if the map is built correctly
          console.error(
            `[Generate Mode] Could not find product reference for original URL: ${result.originalUrl}`,
          );
        }
      }
      logWithTime('Finished updating product URLs in JSON');
    }
    // --- End Generation Calls ---
  }

  // Log overall statistics
  if (totalPlaceholders > 0) {
    logWithTime('Starting to log statistics');
    console.log('--- Image Placeholder Stats ---');
    console.log(`Total Placeholders Found: ${totalPlaceholders}`);

    const totalGenerationAttempted =
      heroGenerationAttempted + productGenerationAttempted;

    if (totalGenerationAttempted > 0) {
      const dbLookupsAttempted = totalPlaceholders - totalGenerationAttempted;
      console.log(
        `  DB Lookups (Stock/Fallback): Attempted=${dbLookupsAttempted}, Matched=${successfulMatches}`,
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
    } else {
      // Log simpler stats for stock mode
      const successRate = (
        (successfulMatches / totalPlaceholders) *
        100
      ).toFixed(2);
      console.log(
        `  DB Lookups: Matched=${successfulMatches} / ${totalPlaceholders} (${successRate}%)`,
      );
    }
    console.log('-----------------------------');
    logWithTime('Finished logging statistics');
  } else {
    console.log('Image Placeholder Stats: No placeholders found to process.');
  }

  logWithTime('Returning final JSON');
  return json;
}
