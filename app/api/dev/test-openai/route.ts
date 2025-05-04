// This route serves as a simple endpoint to test the callOpenAiTextToImage helper function.
// It allows quick validation of the OpenAI API key, model access, and basic interaction.
import { NextResponse } from 'next/server';
import { callOpenAiTextToImage } from '../../../lib/openai-image-api'; // Import the OpenAI helper

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.prompt;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 },
      );
    }

    // Call the OpenAI helper function - expects { blobUrl, hash } or null
    const result = await callOpenAiTextToImage(prompt);

    if (result) {
      // Return the URL and hash obtained from the helper
      return NextResponse.json({ imageUrl: result.blobUrl, hash: result.hash });
    } else {
      // The helper function handles logging errors. Return a generic error here.
      return NextResponse.json(
        {
          error:
            'Failed to generate image via OpenAI. Check server logs for details.', // Updated error message
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error in /api/dev/test-openai route:', error); // Updated log message
    // Handle potential JSON parsing errors or other unexpected issues
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal Server Error', details: message },
      { status: 500 },
    );
  }
}
