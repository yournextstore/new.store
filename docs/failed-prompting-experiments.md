❯ git diff --cached app/api/generate/gen-store-json-prompt.md
diff --git a/app/api/generate/gen-store-json-prompt.md b/app/api/generate/gen-store-json-prompt.md
index 8681605..332e203 100644
--- a/app/api/generate/gen-store-json-prompt.md
+++ b/app/api/generate/gen-store-json-prompt.md
@@ -387,15 +387,18 @@ The placeholder URL **must** follow this exact format:
 `https://yns.img?description=<URL-encoded description>`

 **Description Generation:**
-The `<description>` part should be a **detailed**, objective description (ideally 2-3 sentences) of the desired product image.
-Base the description on the product's `name`, `summary`, and the overall theme/style of the store.
-Focus on key visual elements, style, product category, colors, and materials that would help find a matching image (similar to how the image library descriptions are structured). Aim for clarity and specificity.
-Example: For a product named "Navy Blue Modern Sneaker", a good description might be: `"A sleek, minimalist low-top sneaker in deep blue with a smooth texture, featuring black laces and eyelets and a clean white sole, offering a modern versatile look."` (Notice the detail regarding texture, specific features, and overall aesthetic).
+Generate a detailed description (typically 2-3 sentences) for the `<description>` placeholder of the product image. Focus on product details regardless of their presentation: name, color(s), material, key features, how the product is built/composed, and any relevant thematic elements related to the user's store theme, names, or logos mentioned in the user's overall prompt (e.g., "featuring the AI Kicks logo"). *Exclude* mention of background, lighting, camera angles, or subjective style words (e.g., beautiful, minimalist, modern) – these visual style aspects will be added by a backend template.
+
+Example 1: For a product named "Navy Blue Modern Sneaker", a good description might be:
+`"A low-top sneaker constructed from deep-blue leather. It features black laces threaded through black eyelets and sits on a clean white rubber sole. The heel tab includes the embroidered 'AI Kicks' logo."`
+
+Example 2: For a product named "Warsaw AI Breakfast Community Hat", a good description might be:
+`This black baseball cap features high-quality embroidery of the "Warsaw AI Breakfast" logo in white and yellow thread. The design includes a stylized tree symbol integrated into the letter "A", a cheerful white daisy with a yellow center replacing the letter "I", and bold "BREAKFAST" text beneath a clean underline. Crafted from durable fabric with reinforced stitching and eyelets for breathability, this cap is both a functional accessory and a nod to the Warsaw AI community.`

 **URL Encoding:**
 The generated description **must** be URL-encoded before being included in the placeholder URL.
-This means replacing spaces with `%20`, and encoding other special characters (e.g., `&` becomes `%26`, `?` becomes `%3F`). Most programming environments have standard functions for this. Ensure your output description is properly encoded.
-Example (Encoded): `https://yns.img?description=A%20sleek%2C%20minimalist%20low-top%20sneaker%20in%20deep%20blue%20with%20a%20smooth%20texture%2C%20featuring%20black%20laces%20and%20eyelets%20and%20a%20clean%20white%20sole%2C%20offering%20a%20modern%20versatile%20look.`
+This means replacing spaces with `%20`, and encoding other special characters (e.g., `,` becomes `%2C`, `&` becomes `%26`, `?` becomes `%3F`). Most programming environments have standard functions for this. Ensure your output description is properly encoded.
+Example (Encoded): `https://yns.img?description=A%20low-top%20sneaker%20constructed%20from%20deep-blue%20leather.%20It%20features%20black%20laces%20threaded%20through%20black%20eyelets%20and%20sits%20on%20a%20clean%20white%20rubber%20sole.%20The%20heel%20tab%20includes%20the%20embroidered%20%27AI%20Kicks%27%20logo.`

 **IMPORTANT**: Only use this placeholder format for the `products[].imageUrl` and `HeroSection.data.image.src` (or `HeroSection.data.slides[].image.src`) fields. Other image fields (like `settings.logo`, `settings.ogimage`) should continue using the hardcoded URLs as specified in their respective sections for now.

@@ -407,8 +410,10 @@ For the `image.src` field within the `HeroSection` data (either directly in `dat
 `https://yns.img?description=<URL-encoded description>`

 **Description Generation:**
-The `<description>` part should be a **detailed**, objective description (ideally 2-3 sentences) of the desired hero image.
-Base the description on the overall theme, style, and potentially the products or feeling described in the user's prompt. Focus on visual elements, mood, composition, and colors that represent the store's brand (e.g., "A bright, airy studio setting with natural wood elements displaying minimalist ceramic vases", "A dramatic, high-contrast shot of a sleek black electronic gadget on a dark textured surface"). Aim for descriptions that capture the essence of a potential hero image.
+Generate a factual description (typically 2-3 sentences) for the `<description>` placeholder for the desired hero image. Focus *only* on objective visual elements: subjects, colors, key features, and **any relevant themes, names, or settings mentioned in the user's overall prompt** (e.g., "A panoramic view of the Warsaw skyline at dusk for the AI Breakfast event"). *Strictly exclude* mention of specific background composition, lighting, camera angles, mood, or subjective style words – these visual style aspects may be handled differently by the backend.
+
+Example: For a hero image for a modern science fiction bookstore, a good description might be:
+`"An overhead view of a sleek, modern bookshelf filled neatly with science fiction paperbacks. The books have varied, colorful spines, suggesting a diverse collection related to the store's theme."`