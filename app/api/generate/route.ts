import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const prompt = body.prompt

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required and must be a string' }, { status: 400 })
    }

    // Simulate some processing time (optional)
    // await new Promise(resolve => setTimeout(resolve, 500));

    // For now, just return the received prompt wrapped in a dummy JSON
    const dummyResponse = {
      receivedPrompt: prompt,
      dummyData: 'This is placeholder data from the backend.',
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(dummyResponse)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
} 