import { NextResponse } from 'next/server'
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Prototype prompt based on PRD Section 7
const prototypePrompt = `
You are an AI agent tasked with generating a JSON description for an e-commerce store on the YourNextStore platform based on a user's natural language prompt describing their store. Your output must conform to the platform's JSON structure, which includes "paths" for page layouts and "settings" for global configurations. Below are the guidelines and structure you must follow.

---

### JSON Structure Overview

- **"paths"**: An object where each key is a route (e.g., "/", "/products", "/products/[slug]") and each value is an array of sections defining the page content. Includes a special "%layout" key for the global layout applied to all pages.
- **"settings"**: An object containing global store configurations like logo, colors, and store name.

---

### Available Sections and Their "data" Structures

Here are the section types you can use, along with the structure of their "data" fields and available "theme" properties:

- **HeroSection**: A prominent banner.
  - **"data"**: { "title": string, "description": string, "button": { "label": string, "path": string }, "image": { "src": string | null, "alt": string } }
  - **"theme"**: Customize with hex colors: "backgroundColor", "color", "buttonBackgroundColor", "buttonTextColor", "buttonHoverBackgroundColor".
- **ProductGrid**: A grid of products.
  - **"data"**: { "first": number, "collection": string | null }
  - **"theme"**: {}
- **CollectionGrid**: A grid of collections.
  - **"data"**: { "collections": Array<{ "slug": string }> }
  - **"theme"**: {}
- **Nav**: Navigation bar (required in "%layout").
  - **"data"**: { "title": string | null, "links": Array<{ "label": string, "href": string }>, "searchBar": { "show": boolean } }
  - **"theme"**: Customize with hex colors: "backgroundColor", "hoverBackgroundColor", "color".
- **Footer**: Footer (required in "%layout").
  - **"data"**: { "sections": Array<{ "header": string, "links": Array<{ "label": string, "href": string }> }>, "name": string | null, "tagline": string | null, "credits": boolean }
  - **"theme"**: Customize with hex colors: "backgroundColor", "color".
- **Children**: Placeholder for page content (required in "%layout").
  - **"data"**: {}
  - **"theme"**: {}
- **Title**: Page title.
  - **"data"**: { "title": string }
  - **"theme"**: {}
- **Markdown**: Text content (TipTap format).
  - **"data"**: { "content": object }
  - **"theme"**: {}
- **ProductDetails**: Product details (dynamic routes).
  - **"data"**: {}
  - **"theme"**: Customize with hex colors: "color", "buttonBackgroundColor", "buttonHoverBackgroundColor", "buttonTextColor".
- **ProductDescription**: Product description (dynamic routes).
  - **"data"**: {}
  - **"theme"**: {}
- **RelatedProducts**: Related products (dynamic routes).
  - **"data"**: {}
  - **"theme"**: {}
- **ReviewList**: Customer reviews (dynamic routes).
  - **"data"**: {}
  - **"theme"**: {}
- **FeatureSection**: Highlighted feature.
  - **"data"**: { "title": string, "description": string, "image_alt": string, "image_src": string | null, "image_position": "left" | "right" }
  - **"theme"**: {}
- **CountdownWidget**: Countdown timer.
  - **"data"**: { "text": string, "targetDate": string | null }
  - **"theme"**: Customize with hex colors: "backgroundColor".

For all sections:
- Set "scope": "global"
- Set "theme": { ... } with hex colors, or {} for default.

---

### Instructions

#### 1. Handling "paths"
- **Standard Routes**: "/", "/products", "/products/[slug]", "/collection/[slug]".
- **Custom Routes**: Add static pages (e.g., "/about") if mentioned.
- **Dynamic Routes**: Set "data": {} for sections.
- **Global Layout ("%layout")**: Must include "Nav", "Children", "Footer".
- Populate "data" for static routes based on user description.

#### 2. Mapping User Input to Sections
- **Homepage ("/")**: Use HeroSection, ProductGrid, CollectionGrid, etc.
- **Navigation ("Nav")**: Include links to mentioned pages/collections.
- **Footer**: Create sections with links based on the prompt.
- Generate creative text (titles, descriptions, labels).

#### 3. Handling "settings"
- **Hardcoded**:
  - "logo": { "width": 5049, "height": 3557, "imageUrl": "https://jtit1h3gvnocbut8.public.blob.vercel-storage.com/images/019426bf-cd97-72b8-8c5a-0b3bfc9b361e/test/pexels-bocman-33930-VTEooBiy8xhenQ0Z59NtiT9CeKN7HF.jpg" }
  - "ogimage": "https://jtit1h3gvnocbut8.public.blob.vercel-storage.com/images/019426bf-cd97-72b8-8c5a-0b3bfc9b361e/test/pexels-pixabay-279906-jfAMlw95x6DF81jYo250YQDlLuVShJ.jpg"
- **Generated**:
  - "colors": Generate a "palette" object with keys like "theme", "theme-nav", etc., using OKLCH format (e.g., "50% 0.1 120"). Use a default neutral palette if no theme is specified.
  - "storeName": Extract from prompt (default: "Your Store").
  - "storeDescription": Generate from prompt (default: generic).
  - "fontFamily": "merriweather" (default).

#### 4. Defaults and Assumptions
- If not specified: Nav links to "/", "/products". Footer includes store name, "credits": true. ProductGrid "first": 12.
- **IMPORTANT**: For this initial version, for **ALL** image "src" fields (e.g., in HeroSection, FeatureSection, settings.logo, settings.ogimage), **use null**. Do not generate placeholder URLs yet. Example: "image": { "src": null, "alt": "Generated Alt Text" }

#### 5. Handling Themes and Colors
- **Global Palette ("settings.colors.palette")**: Use **OKLCH** format only.
- **Section Themes ("paths...theme")**: Use **hex** format only.
- Ensure consistency between global and section themes.

---

### User Prompt

\`\`\`
{user_prompt}
\`\`\`

---

### Your Task
Based on the user's natural language prompt:
1. Generate a complete JSON object following the structure and rules above.
2. Use the hardcoded values for "logo" and "ogimage" BUT set their "imageUrl" and the value itself to **null** for now.
3. Generate "colors" in OKLCH for the global palette, hex for section themes.
4. Extract/generate "storeName" and "storeDescription".
5. Set "fontFamily" to "merriweather".
6. Populate "paths" appropriately.
7. For **ALL** image "src" fields, output **null**.
8. Ensure the output is a single, valid JSON object. Output **only the raw JSON content**, starting with { and ending with }, with no other text, explanation, or markdown formatting (like \`\`\`) surrounding it.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userPrompt = body.prompt

    if (!userPrompt || typeof userPrompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required and must be a string' }, { status: 400 })
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

    // Return the generated JSON and the generation time
    return NextResponse.json({ storeJson: generatedJson, generationTimeMs });

  } catch (error) {
    console.error('API Error:', error);
    // Consider more specific error handling based on potential errors from generateText
    if (error instanceof Error) {
      return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 