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

  // Process product images
  if (Array.isArray(json.products)) {
    totalPlaceholders = json.products.filter(
      (p: any) =>
        p &&
        typeof p.imageUrl === 'string' &&
        p.imageUrl.startsWith('https://yns.img?description='),
    ).length;

    for (const product of json.products) {
      if (
        product &&
        typeof product.imageUrl === 'string' &&
        product.imageUrl.startsWith('https://yns.img?description=')
      ) {
        try {
          const url = new URL(product.imageUrl);
          const description = url.searchParams.get('description');

          if (description) {
            // 1. Generate embedding for the AI's description
            const { embedding } = await embed({
              model: EMBEDDING_MODEL,
              value: description,
            });

            // 2. Find best match in the library
            let bestMatchUrl = FALLBACK_IMAGE_URL;
            let highestSimilarity = -1;
            let bestMatchItem: LibraryImageData | null = null;

            for (const item of library) {
              // Ensure the library item has a valid embedding
              if (
                item.embedding &&
                Array.isArray(item.embedding) &&
                item.embedding.length > 0
              ) {
                const similarity = cosineSimilarity(embedding, item.embedding);
                if (similarity > highestSimilarity) {
                  highestSimilarity = similarity;
                  if (similarity >= SIMILARITY_THRESHOLD) {
                    bestMatchUrl = item.url; // Store URL of the best match above threshold
                    bestMatchItem = item; // Store the best matching item itself
                  }
                }
              } else {
                console.warn(
                  `Skipping library item due to invalid embedding: ${item.url}`,
                );
              }
            }

            if (bestMatchItem && bestMatchUrl !== FALLBACK_IMAGE_URL) {
              // Log details including both descriptions
              successfulMatches++; // Increment successful match count
              console.log(
                `Image Match Found (Similarity: ${highestSimilarity.toFixed(4)})\n` +
                  `  - Product: "${product.name || 'Unknown Product'}"\n` +
                  `  - Placeholder Desc: "${description}"\n` +
                  `  - Library Desc: "${bestMatchItem.description}"\n` +
                  `  - Result URL: ${bestMatchUrl}`,
              );
            } else {
              console.warn(
                `No suitable image match found (Highest Similarity: ${highestSimilarity.toFixed(4)}) for description: "${description}". Using fallback.`,
              );
            }
            product.imageUrl = bestMatchUrl;
          } else {
            console.warn(
              'Placeholder URL missing description:',
              product.imageUrl,
            );
            product.imageUrl = FALLBACK_IMAGE_URL; // Fallback if description is missing
          }
        } catch (error) {
          console.error('Error processing image placeholder:', error);
          product.imageUrl = FALLBACK_IMAGE_URL; // Fallback on error
        }
      }
    }
  }

  // TODO: Add logic here to replace placeholders in other locations
  // (logo, ogimage, sections) when that task is implemented.

  // Log statistics
  if (totalPlaceholders > 0) {
    const successRate = ((successfulMatches / totalPlaceholders) * 100).toFixed(
      2,
    );
    console.log(
      `Image Placeholder Stats: Processed=${totalPlaceholders}, Matched=${successfulMatches}, Success Rate=${successRate}%`,
    );
  } else {
    console.log(
      'Image Placeholder Stats: No product image placeholders found to process.',
    );
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
      return NextResponse.json(
        { error: 'Prompt placeholder not found in prototype prompt' },
        { status: 400 },
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

    // Parse the AI's response as JSON
    let generatedJson: unknown;
    try {
      // remove markdownesque formatting
      // remove leading ```json and trailing ```
      generatedJson = JSON.parse(
        text
          .trim()
          .replaceAll(/^```json/g, '')
          .replaceAll(/```$/g, '')
          .trim(),
      );
    } catch (parseError) {
      console.error('JSON Parsing Error:', parseError);
      console.error('Raw AI Response:', text); // Log the raw text for debugging
      return NextResponse.json(
        {
          error: 'Failed to parse AI response as JSON',
          details: (parseError as Error).message,
          rawResponse: text,
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

    try {
      const ynsResponse = await fetch(ynsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.YNS_AI_API_KEY}`,
        },
        body: JSON.stringify(finalJson), // Send the JSON with replaced image URLs
      });

      if (!ynsResponse.ok) {
        const errorText = await ynsResponse.text();
        console.error(`YNS API Error (${ynsResponse.status}): ${errorText}`);
        return NextResponse.json(
          {
            error: 'Failed to create store on YNS platform',
            details: errorText,
          },
          { status: ynsResponse.status },
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
        { error: 'Failed to communicate with YNS platform' },
        { status: 500 },
      );
    }
    // --- End YNS API Call ---
  } catch (error) {
    console.error('API Error:', error);
    // Consider more specific error handling based on potential errors from generateText
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Internal Server Error', details: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
