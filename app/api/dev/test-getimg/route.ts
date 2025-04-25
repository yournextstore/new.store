// This route serves as a simple endpoint to test the callGetImgApi helper function.
// It allows quick validation of the getimg.ai API key, endpoint, and basic interaction.
// It can potentially be removed later if the main /api/generate flow provides sufficient testing.
import { NextResponse } from 'next/server';
import { callGetImgApi } from '../../../lib/getimg-api'; // Adjust path as needed

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

    // Call the shared helper function
    const imageUrl = await callGetImgApi(prompt);

    if (imageUrl) {
      // Return the URL obtained from the helper
      return NextResponse.json({ imageUrl: imageUrl });
    } else {
      // The helper function handles logging errors. Return a generic error here.
      return NextResponse.json(
        {
          error:
            'Failed to generate image via getimg.ai. Check server logs for details.',
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Error in /api/dev/test-getimg route:', error);
    // Handle potential JSON parsing errors or other unexpected issues
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal Server Error', details: message },
      { status: 500 },
    );
  }
}
