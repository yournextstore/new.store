import { NextResponse } from 'next/server'
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import fs from 'fs';


export async function POST(req: Request) {
  try {
    // main prompt that generates the complete store JSON representation
    const prototypePrompt = fs.readFileSync('app/api/generate/gen-store-json-prompt.md', 'utf8');
    console.log('Loaded `gen-store-json-prompt.md`')
    console.log('prototypePrompt', prototypePrompt)

    const body = await req.json()
    const userPrompt = body.prompt
    const userId = body.userId

    if (!userPrompt || typeof userPrompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required and must be a string' }, { status: 400 })
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'User ID is required and must be a string' }, { status: 400 });
    }

    // Check that {user_prompt} is present in the prototypePrompt
    if (!prototypePrompt.includes('{user_prompt}')) {
      return NextResponse.json({ error: 'Prompt placeholder not found in prototype prompt' }, { status: 400 })
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
      system: "You are an AI assistant designed to output ONLY raw JSON data. Do not include any explanations, markdown formatting, or text outside the JSON structure.",
    });

    const endTime = Date.now(); // Record end time
    const generationTimeMs = endTime - startTime; // Calculate duration

    // Parse the AI's response as JSON
    let generatedJson;
    try {
      generatedJson = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON Parsing Error:', parseError);
      console.error('Raw AI Response:', text); // Log the raw text for debugging
      return NextResponse.json({ error: 'Failed to parse AI response as JSON', details: (parseError as Error).message, rawResponse: text }, { status: 500 });
    }

    // --- Call YNS API ---
    const ynsApiUrl = `https://yns.cx/admin/ai-test/import?userId=${userId}`;
    console.log(`Calling YNS API: ${ynsApiUrl}`);

    try {
      const ynsResponse = await fetch(ynsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(generatedJson), // Send the AI-generated JSON
      });

      if (!ynsResponse.ok) {
        const errorText = await ynsResponse.text();
        console.error(`YNS API Error (${ynsResponse.status}): ${errorText}`);
        return NextResponse.json({ error: 'Failed to create store on YNS platform', details: errorText }, { status: ynsResponse.status });
      }

      const ynsResult = await ynsResponse.json();
      console.log('YNS API Success Response:', ynsResult);

      if (!ynsResult.url) {
        console.error('YNS API response missing URL:', ynsResult);
        return NextResponse.json({ error: 'YNS API did not return a store URL', details: ynsResult }, { status: 500 });
      }

      // Return the YNS store URL, the original JSON, and the generation time
      return NextResponse.json({ storeUrl: ynsResult.url, storeJson: generatedJson, generationTimeMs });

    } catch (ynsApiError) {
      console.error('Error calling YNS API:', ynsApiError);
      if (ynsApiError instanceof Error) {
        return NextResponse.json({ error: 'Failed to communicate with YNS platform', details: ynsApiError.message }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to communicate with YNS platform' }, { status: 500 });
    }
    // --- End YNS API Call ---

  } catch (error) {
    console.error('API Error:', error);
    // Consider more specific error handling based on potential errors from generateText
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 