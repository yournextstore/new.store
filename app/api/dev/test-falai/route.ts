// This route serves as a simple endpoint to test the callFalAiTextToImage helper function.
// It allows quick validation of the Fal AI API key and basic interaction.
import { NextResponse } from 'next/server';
import { callFalAiTextToImage } from '../../../lib/fal-api'; // Import the Fal AI helper

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

    // Call the Fal AI helper function
    const imageUrl = await callFalAiTextToImage(prompt);

    if (imageUrl) {
      // Return the URL obtained from the helper
      return NextResponse.json({ imageUrl: imageUrl });
    } else {
      // The helper function handles logging errors. Return a generic error here.
      return NextResponse.json(
        {
          error:
            'Failed to generate image via Fal AI. Check server logs for details.', // Updated error message
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error in /api/dev/test-falai route:', error); // Updated log message
    // Handle potential JSON parsing errors or other unexpected issues
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal Server Error', details: message },
      { status: 500 },
    );
  }
}
