import { type NextRequest, NextResponse } from 'next/server';

const GETIMG_API_KEY = process.env.GETIMG_API_KEY;
const GETIMG_ENDPOINT = 'https://api.getimg.ai/v1/flux-schnell/text-to-image';

export async function POST(req: NextRequest) {
  if (!GETIMG_API_KEY) {
    return NextResponse.json(
      { error: 'GETIMG_API_KEY environment variable is not set.' },
      { status: 500 },
    );
  }

  let prompt: string;
  try {
    const body = await req.json();
    prompt = body.prompt;
    if (!prompt) {
      throw new Error('Missing prompt in request body.');
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid request body. Ensure it is JSON with a "prompt" field.',
      },
      { status: 400 },
    );
  }

  console.log(`⏳ Calling getimg.ai for prompt: "${prompt}"`);

  try {
    const response = await fetch(GETIMG_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${GETIMG_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        width: 1024, // Defaulting to 1024x1024 as per bash example
        height: 1024,
        response_format: 'url', // Requesting direct image URL
      }),
    });

    if (!response.ok) {
      const errorData = await response.text(); // Read error details
      console.error(
        `❌ getimg.ai API error: ${response.status} ${response.statusText}`,
        errorData,
      );
      return NextResponse.json(
        {
          error: `getimg.ai API error: ${response.statusText}`,
          details: errorData,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    // Based on the bash script and common API patterns, the URL might be in 'imageUrl' or 'url'
    const imageUrl = data.imageUrl || data.url || data.images?.[0]?.url;

    if (!imageUrl) {
      console.error('❌ Could not find image URL in getimg.ai response:', data);
      return NextResponse.json(
        {
          error: 'Failed to extract image URL from getimg.ai response.',
          responseData: data,
        },
        { status: 500 },
      );
    }

    console.log(`✅ Successfully got image URL: ${imageUrl}`);
    return NextResponse.json({ imageUrl });
  } catch (error: any) {
    console.error('❌ Failed to call getimg.ai API:', error);
    return NextResponse.json(
      { error: 'Failed to process request.', details: error.message },
      { status: 500 },
    );
  }
}
