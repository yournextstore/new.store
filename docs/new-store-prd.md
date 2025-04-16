# PRD: `store.new` – AI-Powered E-commerce Store Generator

## 1. Overview

`store.new` is a service hosted at `store.new` that enables users to create a functional e-commerce store on the YourNextStore platform by providing a natural language description of their desired store (e.g., "a luxury candle store with a minimalist theme"). An AI agent, powered by GPT-4o, generates a comprehensive JSON description based on the user's input, which is sent to YourNextStore via a single API endpoint to create the store. The YourNextStore API only validates and stores this JSON. The process concludes with a live preview of the generated store displayed in the browser.

This PRD defines the requirements for a proof of concept (PoC) to be completed in 10 days by a team of three senior engineers. The focus is on delivering a minimal, functional end-to-end flow, leveraging the team's expertise to handle implementation details.

**Tech Stack:**
- **Next.js**: Frontend and backend framework.
- **Vercel**: Deployment and hosting platform.
- **AI SDK**: For integrating AI capabilities (by Vercel).
- **TypeScript**: Language for type safety and maintainability.
- **GPT-4o**: AI model for generating store JSON and image descriptions.
- `text-embedding-3-small`: embedding model for image descriptions.

---

## 2. User Flow

1. **User Input:**  
   - The user enters a description of their desired store into a text box.  
   - The UI provides 2-3 predefined example buttons (e.g., "Fashion Store," "Electronics Store") that prefill the text box with sample prompts.  

2. **AI Generation:**  
   - Upon clicking "Generate," the AI agent processes the input and generates a JSON object defining the store's structure, content, and theme.  

3. **Store Creation:**  
   - The JSON is sent to YourNextStore's API, which returns either an error (if invalid) or a domain name for the created store.  

4. **Preview:**  
   - The store is displayed in an iframe on the right side of the screen, with the user's prompt visible on the left for reference.  
   - There's also a separate toggle/switch for preview of the generated JSON code.

**Rationale:**  
- A simple, intuitive flow mirrors successful models like `new.email`, ensuring minimal input yields a tangible output.  
- Predefined examples guide users, making the tool accessible even for vague or broad inputs.

---

## 3. Functional Requirements

### 3.1 User Interface (UI)
- **Two-Column Layout:**  
  - **Left Column:** Text box for user input with 2-3 predefined example buttons below.  
  - **Right Column:** Iframe to display the live store preview once generated.  
  - **Toggle/Switch:** For preview of the generated JSON code.
- **Input Guidance:**  
  - Placeholder text in the input box (e.g., "Describe your store...").  
  - Example buttons prefill prompts like "A modern fashion store with minimalist design."  

**Rationale:**  
- The two-column layout keeps the input visible alongside the result, providing context.  
- Predefined examples reduce user friction and ensure functional outputs.

### 3.2 AI Agent
- **Input Processing:**  
  - Accepts broad or specific descriptions, using defaults for vague inputs (e.g., generic store name, neutral theme).  
- **Output:**  
  - Generates a comprehensive JSON object conforming to the YourNextStore structure, including:
    - Store name and description.
    - Theme (from a predefined set).
    - 2-3 categories (e.g., "Men," "Women" for clothing).
    - Full definitions for 6-12 products including names, summaries, prices.
    - Generates **image placeholder URLs** (see Section 4.2.1) for required images (e.g., for HeroSection, FeatureSection, and individual products) instead of direct image URLs.
- **Prompt Engineering:**  
  - Uses the provided prototype prompt as a starting point.  
  - Ensures valid JSON with OKLCH colors for the global palette and hex colors for section themes.  

**Rationale:**  
- Defaults ensure functionality with minimal input, aligning with the PoC's feasibility focus.  
- The prototype prompt reduces initial engineering effort, though iteration may be needed.

### 3.3 API Integration
- **Backend Processing:**
  - Before sending to YourNextStore, the backend intercepts the AI-generated JSON.
  - It identifies special **image placeholder URLs** (see Section 4.2.1) within the JSON structure.
  - It parses these placeholders to extract the AI-generated description for the desired image.
  - It uses these *specific* descriptions to select appropriate image URLs from a predefined library via in-memory vector similarity search against pre-computed embeddings (associated with the library images' descriptions).
  - It inserts these selected image URLs into the JSON object, replacing the original placeholder URLs.
- **Send JSON to YourNextStore:**
  - POST the **finalized** JSON (with image URLs included) to the YourNextStore API endpoint. The YourNextStore API is solely responsible for validating the structure and content of the submitted JSON; no pre-validation occurs in the `store.new` backend for this PoC.
- **Handle API Response:**  
  - Success: Retrieve the domain name and load the store in the iframe.  
  - Error: Display a user-friendly message (e.g., "Unable to generate store. Please try again.").  

**Rationale:**  
- Focusing on the core flow (input → AI → JSON → API → preview) keeps the PoC manageable within 10 days.

### 3.4 Preview
- **Iframe Embedding:**  
  - Load the store using the domain name returned by the API.  
- **Error Handling:**  
  - Display an error message if the API fails or the store cannot load.  

### 3.5 Product Images & Layout Images:
  - A library of ~200 categorized images (e.g., fashion, electronics, lifestyle) stored statically within the project repository.
  - Each image has an associated descriptive text (e.g., "Minimalist workspace with laptop and plant", "Close-up of a steaming cup of coffee") stored alongside, likely in a JSON file.
  - Embeddings for these descriptions are pre-computed by a developer using a dedicated script *before* runtime (e.g., during development) and stored as static data (e.g., another JSON file) committed to the repository. This process is *not* part of the automated build pipeline.

**Rationale:**
- Predefined assets simplify AI tasks, ensuring consistency and accelerating development.
- Pre-computing embeddings offline and using in-memory search provides efficient image selection without external dependencies or build-time overhead.

---

## 4. Technical Architecture

### 4.1 Frontend (Next.js)
- **UI Components:**  
  - Text input with placeholder and example buttons.  
  - Iframe for preview.  
- **State Management:**  
  - Manage user input, loading states, and error messages.  

### 4.2 Backend (Next.js API Routes)
- **AI Integration:**  
  - Use AI SDK to call GPT-4o with the user's prompt and prototype prompt.  
- **JSON Generation:**  
  - AI generates the initial JSON structure, including specially formatted **image placeholder URLs** where final image `src` values are needed. See Section 4.2.1 for details.

#### 4.2.1 Image Placeholder and Selection Strategy

To communicate image requirements from the AI agent to the backend for lookup in the static library, this system uses a specific placeholder URL format embedded directly within the standard `image.src` fields of the generated JSON.

- **Placeholder Format:** The AI agent will be instructed to generate URLs in the following format for any required image:
  `https://yns.img?description=<URL-encoded description>`
  Where `<URL-encoded description>` is the AI's generated textual description of the desired image, properly URL-encoded (e.g., spaces become `%20`).

- **Example within JSON:**
  ```json
  {
    "id": "HeroSection",
    "data": {
      "title": "Artisan Coffee Roasters",
      "description": "Discover expertly roasted beans.",
      "button": { "label": "Explore Blends", "path": "/products" },
      "image": {
        "src": "https://yns.img?description=close-up%20of%20freshly%20roasted%20coffee%20beans%20spilling%20from%20a%20burlap%20sack",
        "alt": "Freshly roasted coffee beans" // AI can still generate alt text
      }
    },
    "theme": { "backgroundColor": "#f5f0e8", "color": "#4a2c2a" }
  }
  ```

- **Rationale:**
  - **Standard Structure:** Leverages the existing `image.src` field, minimizing changes to the JSON schema the AI needs to learn and produce.
  - **Clear Signal:** Provides an unambiguous, machine-parseable signal to the backend that an image lookup and replacement are required for this specific field.
  - **Encapsulation:** Keeps the description of the required image directly associated with the field where the final URL belongs.
  - **Simplified Backend Logic:** Makes it easy for the backend to find all required image lookups by simply scanning for URLs starting with `https://yns.img?`.

- **Backend Image Selection (Implementation):**
  - The backend API route handler intercepts the JSON from the AI.
  - It scans the JSON for `src` fields containing URLs matching the `https://yns.img?description=` pattern.
  - For each match, it extracts and URL-decodes the `description` parameter.
  - It calculates an embedding for this description using `text-embedding-3-small` (via the Vercel AI SDK `embed` function).
  - It performs a simple linear similarity search (calculating cosine similarity) using primitives from the Vercel AI SDK (e.g., `cosineSimilarity` function, see [AI SDK Embeddings Docs](https://sdk.vercel.ai/docs/ai-sdk-core/embeddings#embedding-similarity)) against the pre-computed embeddings of the static image library (see Section 3.5).
  - It selects the URL of the best-matching image from the library based on the highest similarity score.
  - It replaces the original placeholder URL (e.g., `https://yns.img?...`) in the JSON with the selected static image URL (e.g., `/images/library/coffee_beans_close_up.jpg`).
  - Implements fallback logic (e.g., using a default placeholder image URL or logging a warning) if no suitable match is found above a certain similarity threshold.

- **API Call:**  
  - Send JSON to YourNextStore's API and process the response.  

### 4.3 Assets
- **Predefined Themes:**  
  - 3-5 themes (e.g., minimalist, vibrant, classic) with OKLCH color palettes.  
- **Product Images:**  
  - Categorized images (e.g., fashion, electronics) stored in a static JSON file or codebase. Images will be stored along with AI-generated English descriptions that will be used by the AI agent to select the right product images.

**Rationale:**  
- Predefined assets simplify AI tasks, ensuring consistency and accelerating development.

---

## 5. Assumptions and Constraints

### 5.1 Assumptions
- **Static Store Structure:**
  - Fixed paths: `/`, `/products`, `/products/[slug]`, `/collection/[slug]`. *(Note: `/collection/[slug]` is included but its necessity might be re-evaluated during development).*
  - No layout customization in v0.
- **Predefined Themes and Images:**
  - Themes are selected from a predefined set.
  - Images (layout and product) are selected by the backend from a predefined library using **AI-generated descriptions embedded in placeholder URLs** (see Section 4.2.1) via vector search.
- **AI Output:**
  - Generates 2-3 categories and full definitions for 6-12 products (excluding final image URLs).
  - Provides **image placeholder URLs** containing descriptive text for all required images.
- **API Response:**  
  - Returns a domain name or an error message.  

**Rationale:**  
- A static structure focuses the AI on content generation, simplifying the PoC.  
- Predefined assets ensure consistency and reduce complexity.

### 5.2 Constraints
- **Timeline:** 10 days with three senior engineers.  
- **No Product Variants:** Products lack variants (e.g., size, color).  
- **Minimal Error Handling:** Prioritizes core flow; edge cases are deferred.  
- **Static Image Embeddings:** Image description embeddings are generated offline by developers and committed; they are not generated dynamically or during the build.
- **Image Description Format:** AI must generate image requirements using the specific placeholder URL format defined in Section 4.2.1.
- **JSON Validation:** For the PoC, JSON validation is intentionally deferred to the receiving YourNextStore API. No separate validation layer will be built within the `store.new` backend.
- **Detailed Error Handling:** Specific strategies for handling various error conditions (e.g., AI failures, image search fallbacks, API errors) will be defined during development.

**Areas for Further Investigation:**  
- **Minimal Set of Paths:** Validate if `/collection/[slug]` is essential for the core PoC functionality or can be deferred.
- **Image Descriptions and Matching Quality:** Ensure high-quality image descriptions in the static library and test the effectiveness of matching them against AI-generated descriptions extracted from placeholder URLs.
- **AI Prompt Refinement:** Test and iterate the prototype prompt for consistent, valid JSON outputs, including correctly formatted image placeholder URLs with effective descriptions suitable for vector search.
- **Error Handling:** Explore edge cases (e.g., invalid inputs, API downtime, image search fallback logic) during development. Detailed error handling strategies beyond the basic success/failure paths will be clarified during the implementation phases.

---

## 6. Implementation Plan

The PoC will be delivered in four phases over 10 days:

### Phase 1: Core Infrastructure and AI Integration (Days 1-3)
- [x] Set up Next.js project with Vercel deployment, based on the Chat SDK by Vercel: https://github.com/vercel/ai-chatbot
- [x] Cleanup the initial project structure
  - [x] Disable auth protection for the routes and pages for faster development. We might want to add the auth protection back in the future.
  - [x] Add `/` route that serves a homepage with a form for prompt input.
- [x] Integrate AI SDK and GPT-4o for JSON generation (initially without image placeholder urls).
- [x] Implement the prototype prompt and test initial JSON structure outputs.
  - [x] Add a simple POST call to YNS API to send the JSON and get a domain name in return.
- [x] **Develop Image Library and Embedding Script:** Create the initial image library (~50-100 images) with descriptions in a JSON file. Develop and run the script to pre-compute and store embeddings for these descriptions (`text-embedding-3-small`). Commit image files and JSON data (descriptions, embeddings) to the repository.
  - [x] Download the initial images from the toy image scratchpad and store them in the `./public/images/library/` folder.
  - [x] Create a script to generate textual descriptions for the images and pre-compute and store embeddings for the image descriptions based on image files stored in the Git repo, at `./public/images/library/`.
  - [x] Commit the image files and JSON data (descriptions, embeddings) to the repository.
  - [x] Move image storage to Vercel Blob Storage.


### Phase 2: UI, User Flow, and Image Placeholder Generation (Days 4-5)
- [x] Build the two-column UI (prompt input with examples on the left, iframe preview on the right).
- [x] Add predefined example buttons (e.g., "Fashion Store").
- [ ] Implement basic form validation and error handling.
- [x] Refine AI prompt to generate **image placeholder URLs** (as defined in Sec 4.2.1) for **product images** (`products[].imageUrl`).

### Phase 3: Backend Image Selection and API Integration (Days 6-7)
- [x] Implement backend logic to parse **image placeholder URLs**, load static embeddings, generate query embeddings using the Vercel AI SDK (`embed`), perform linear vector search using Vercel AI SDK primitives (`cosineSimilarity`), select the best match, and inject final image URLs into the JSON object (as defined in Sec 4.2.1). Implement basic fallback logic.
- [ ] Integrate with YourNextStore's API to send the finalized JSON and retrieve the store domain.

### Phase 4: Testing and Refinement (Days 8-10)
- [ ] Test end-to-end flow with various inputs (broad and specific).
- [ ] Refine the AI prompt based on output quality.
- [ ] Ensure the preview loads correctly and the store is functional.
- [ ] Refine AI prompt to generate **image placeholder URLs** (as defined in Sec 4.2.1) for **logo, ogimage, and section images** (e.g., HeroSection, FeatureSection).

**Rationale:**  
- Phased development prioritizes critical components (AI and infrastructure), and getting end-to-end flow working early, allowing iterative refinement later.

---

## 7. Prototype Prompt for AI Agent

Below is an example of a prototype of the prompt to the AI agent; it should serve as a starting point, and illustration but it's not the final prompt by any means. It defines the JSON structure, section types, and color rules, and illustrates some detailed concepts and ideas how to prompt the AI agent.

`````markdown
## Prompt for AI Agent

You are an AI agent tasked with generating a JSON description for an e-commerce store on the YourNextStore platform based on a user's natural language prompt describing their store. Your output must conform to the platform's JSON structure, which includes "paths" for page layouts and "settings" for global configurations. Below are the guidelines and structure you must follow.

---

### JSON Structure Overview

- **"paths"**: An object where each key is a route (e.g., "/", "/products", "/products/[slug]") and each value is an array of sections defining the page content. Includes a special "%layout" key for the global layout applied to all pages.
- **"settings"**: An object containing global store configurations like logo, colors, and store name.

---

### Available Sections and Their "data" Structures

Here are the section types you can use, along with the structure of their "data" fields and available "theme" properties:

- **HeroSection**: A prominent banner.
  - **"data"**: 
    ```json
    {
      "title": string,
      "description": string,
      "button": { "label": string, "path": string },
      "image": { "src": string | null, "alt": string }
    }
    ```
  - **"theme"**: Customize with these properties (use hex color format, e.g., "#ffffff"):
    - `"backgroundColor"`: Background color.
    - `"color"`: Text color.
    - `"buttonBackgroundColor"`: Button background color.
    - `"buttonTextColor"`: Button text color.
    - `"buttonHoverBackgroundColor"`: Button background color on hover.
  - **Example**:
    ```json
    {
      "id": "HeroSection",
      "data": { "title": "Welcome", "description": "Discover our products", "button": { "label": "Shop Now", "path": "/products" }, "image": { "src": "hero.jpg", "alt": "Hero Image" } },
      "theme": { "backgroundColor": "#f0f0f0", "color": "#333333" }
    }
    ```

- **ProductGrid**: A grid of products.
  - **"data"**: 
    ```json
    { "first": number, "collection": string | null }
    ```
  - **"theme"**: Set to `{}` to inherit from the global palette. No specific theme properties are available.

- **CollectionGrid**: A grid of collections.
  - **"data"**: 
    ```json
    { "collections": Array<{ "slug": string }> }
    ```
  - **"theme"**: Set to `{}` to inherit from the global palette. No specific theme properties are available.

- **Nav**: Navigation bar (required in "%layout").
  - **"data"**: 
    ```json
    { "title": string | null, "links": Array<{ "label": string, "href": string }>, "searchBar": { "show": boolean } }
    ```
  - **"theme"**: Customize with these properties (use hex color format):
    - `"backgroundColor"`: Background color.
    - `"hoverBackgroundColor"`: Background color of links on hover.
    - `"color"`: Text color of the links.
  - **Example**:
    ```json
    {
      "id": "Nav",
      "data": { "title": "My Store", "links": [{ "label": "Home", "href": "/" }], "searchBar": { "show": true } },
      "theme": { "backgroundColor": "#ffffff", "color": "#007bff" }
    }
    ```

- **Footer**: Footer (required in "%layout").
  - **"data"**: 
    ```json
    { "sections": Array<{ "header": string, "links": Array<{ "label": string, "href": string }> }>, "name": string | null, "tagline": string | null, "credits": boolean }
    ```
  - **"theme"**: Customize with these properties (use hex color format):
    - `"backgroundColor"`: Background color.
    - `"color"`: Text color.
  - **Example**:
    ```json
    {
      "id": "Footer",
      "data": { "sections": [{ "header": "Company", "links": [{ "label": "About Us", "href": "/about" }] }], "name": "My Store", "credits": true },
      "theme": { "backgroundColor": "#333333", "color": "#ffffff" }
    }
    ```

- **Children**: Placeholder for page content (required in "%layout").
  - **"data"**: `{}`
  - **"theme"**: Set to `{}` to inherit from the global palette.

- **Title**: Page title.
  - **"data"**: 
    ```json
    { "title": string }
    ```
  - **"theme"**: Set to `{}` to inherit from the global palette.

- **Markdown**: Text content in TipTap format.
  - **"data"**: 
    ```json
    { "content": object }
    ```
  - **"theme"**: Set to `{}` to inherit from the global palette.

- **ProductDetails**: Product details (for dynamic routes).
  - **"data"**: `{}`
  - **"theme"**: Customize with these properties (use hex color format):
    - `"color"`: Text color.
    - `"buttonBackgroundColor"`: Button background color.
    - `"buttonHoverBackgroundColor"`: Button background color on hover.
    - `"buttonTextColor"`: Button text color.

- **ProductDescription**: Product description (for dynamic routes).
  - **"data"**: `{}`
  - **"theme"**: Set to `{}` to inherit from the global palette.

- **RelatedProducts**: Related products (for dynamic routes).
  - **"data"**: `{}`
  - **"theme"**: Set to `{}` to inherit from the global palette.

- **ReviewList**: Customer reviews (for dynamic routes).
  - **"data"**: `{}`
  - **"theme"**: Set to `{}` to inherit from the global palette.

- **FeatureSection**: Highlighted feature with text and image.
  - **"data"**: 
    ```json
    { "title": string, "description": string, "image_alt": string, "image_src": string | null, "image_position": "left" | "right" }
    ```
  - **"theme"**: Set to `{}` to inherit from the global palette.

- **CountdownWidget**: Countdown timer.
  - **"data"**: 
    ```json
    { "text": string, "targetDate": string | null }
    ```
  - **"theme"**: Customize with these properties (use hex color format):
    - `"backgroundColor"`: Background color.

For all sections:
- Set `"scope"`: "global"
- Set `"theme"`: `{ ... }` with properties customized for the section based on the design you envision, or `{}` if no custom theme is needed. Use hex color format for all color properties in section themes.

---

### Instructions

#### 1. Handling "paths"
- **Standard Routes**: Include these unless the user specifies otherwise:
  - **"/"**: Homepage (e.g., HeroSection, ProductGrid).
  - **"/products"**: Product listing page (e.g., ProductGrid with "first": 12).
  - **"/products/[slug]"**: Individual product page (e.g., ProductDetails, ProductDescription).
  - **"/collection/[slug]"**: Collection page (e.g., ProductGrid with "first": 6).
- **Custom Routes**: Add static pages (e.g., "/about") if mentioned by the user, using sections like Title and Markdown.
- **Dynamic Routes**: For "/products/[slug]" and "/collection/[slug]", set "data": {} for all sections.
- **Global Layout ("%layout")**: Always include:
  - "Nav" (with links based on user input).
  - "Children" (with "data": {}).
  - "Footer" (with sections based on user input).
- Populate "data" for static route sections based on the user's description (e.g., titles, links).

#### 2. Mapping User Input to Sections
- **Homepage ("/")**: Add HeroSection for banners, ProductGrid for product lists, CollectionGrid for collections, etc., based on user description.
- **Navigation ("Nav")**: Include links to pages/collections mentioned (e.g., "Home" to "/", "Products" to "/products").
- **Footer**: Create sections (e.g., "Shop", "Company") with links derived from the user's prompt.
- **Product Pages ("/products/[slug]")**: Add RelatedProducts or ReviewList if the user mentions them.
- **Custom Pages**: For pages like "/about", use Title and Markdown with content from the user's description.
- Generate text (titles, descriptions, button labels) creatively based on the store's theme and user input.

#### 3. Handling "settings"
- **Hardcoded Values**: Use these exactly as provided:
  - `"logo"`: { "width": 5049, "height": 3557, "imageUrl": "https://jtit1h3gvnocbut8.public.blob.vercel-storage.com/images/019426bf-cd97-72b8-8c5a-0b3bfc9b361e/test/pexels-bocman-33930-VTEooBiy8xhenQ0Z59NtiT9CeKN7HF.jpg" }
  - `"ogimage"`: "https://jtit1h3gvnocbut8.public.blob.vercel-storage.com/images/019426bf-cd97-72b8-8c5a-0b3bfc9b361e/test/pexels-pixabay-279906-jfAMlw95x6DF81jYo250YQDlLuVShJ.jpg"
- **Generated Values**:
  - `"colors"`: Generate a `"palette"` object based on the user's description of their store. Include keys such as `"theme"`, `"theme-nav"`, `"theme-button"`, `"theme-footer"`, and `"theme-primary"`, each with sub-properties like `"DEFAULT"` and `"background"`. Assign OKLCH color values (e.g., "50% 0.1 120") that reflect the store's theme (e.g., modern, vintage). If no design preference is specified, use a default neutral palette.
  - `"storeName"`: Extract from the user's prompt (e.g., "Tech Gadgets"); default to "Your Store" if not specified.
  - `"storeDescription"`: Generate a brief description from the prompt (e.g., "Discover the best in electronics").
  - `"fontFamily"`: Set to "merriweather" (default).

#### 4. Defaults and Assumptions
- If the user doesn't specify:
  - Navigation: Include links to "/", "/products", and any mentioned collections.
  - Footer: Include a section with the store name and "credits": true.
  - ProductGrid: Set "first": 12.
- For images (e.g., HeroSection), use "src": "https://stripe-camo.global.ssl.fastly.net/cd09e4877d3e3e8aa26b05d8778f75f8a814c1660e0de4fe443c76ca2ee07aae/68747470733a2f2f66696c65732e7374726970652e636f6d2f6c696e6b732f4d44423859574e6a644638785433426165473547536d4e57625668366255527366475a735833526c633352666258425856477445515538784e6a68355a575257574852336155396d526a526f3030336e67523942526a".

#### 5. Handling Themes and Colors
- **Global Color Palette in "settings"**:
  - All color values within `"settings" > "colors" > "palette"` must use the **OKLCH format** (e.g., "50% 0.1 120").
  - This palette defines the store's overall color scheme.
  - **Example**:
    ```json
    "settings": {
      "colors": {
        "palette": {
          "theme": { "background": "100% 0 0" },
          "theme-nav": { "DEFAULT": "13.63% 0.0364 259.2", "background": "100% 0 0" },
          "theme-button": { "DEFAULT": "50% 0.15 210" }
        }
      }
    }
    ```
- **Section-Specific Themes in "paths"**:
  - All color values within section `"theme"` objects must use the **hex format** (e.g., "#ffffff").
  - Use sparingly to maintain cohesion with the global palette.
  - **Example**:
    ```json
    "paths": {
      "/": [
        { "id": "HeroSection", "data": { ... }, "theme": { "backgroundColor": "#f0f0f0", "color": "#333333" } }
      ]
    }
    ```
- **Key Rule**:
  - Use **OKLCH format only in "settings" > "colors" > "palette"**.
  - Use **hex format for all colors in section "theme" objects**.
- **Consistency**: Ensure section themes complement the global palette.

---

### User Prompt

```
{user_prompt}
```

---

### Your Task
Based on the user's natural language prompt:
1. Generate a complete JSON object following the structure and rules above.
2. Use the hardcoded values for "logo" and "ogimage" as specified.
3. Generate "colors" in OKLCH format for the global palette and use hex format for section themes.
4. Extract "storeName" and "storeDescription" from the prompt, defaulting to "Your Store" and a generic description if not provided.
5. Populate "paths" with appropriate sections and data based on the user's description.
6. Ensure the JSON is syntactically correct and includes all required fields.
7. Output only the JSON object as your response.
`````

This prompt has several simplifications (e.g. the hardcoded logo/ogimage URLs) that will be addressed during the development of this project, following the image selection strategy outlined in Section 4.2.1 (backend selecting images from a static library based on *AI-generated descriptions extracted from placeholder URLs*, matched against *pre-computed descriptions* in the library).

**Areas for Further Investigation:**
- Test the prompt with diverse inputs and refine it to ensure consistent, valid JSON outputs, including useful and correctly formatted image placeholder URLs suitable for the vector search matching process.
- Evaluate the effectiveness and performance of the in-memory vector search implementation for matching AI descriptions (from placeholders) to library descriptions.

## External resources

- https://yns.app/admin/ai-test - UI (textbox input) for testing the JSON representation of a store.
- https://yns.app/admin/ai-test/schema.json - JSON schema for the store's JSON representation.
- https://yns.app/admin/ai-test/store.json - a dump of JSON object representing a store currently in the YourNextStore database.
