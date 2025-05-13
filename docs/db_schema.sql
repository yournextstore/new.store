-- Optional: Enable UUID generation functions if not already enabled
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE images (
    -- Use gen_random_uuid() available in modern PostgreSQL/Neon
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blob_url TEXT NOT NULL,
    description TEXT NOT NULL,
    -- Dimension for text-embedding-3-small (1536)
    embedding VECTOR(1536) NOT NULL,
    hash TEXT NOT NULL, -- SHA256 hash of the image content
    filename TEXT, -- Optional: original filename for reference
    shortName TEXT, -- Optional: short AI-generated name
    blob_pathname TEXT NOT NULL UNIQUE, -- Pathname used in Vercel Blob, ADDED UNIQUE constraint
    -- Specific to certain image types (e.g., hero images), NULL otherwise
    layout_hint TEXT CHECK (layout_hint IN ('left', 'right', 'center')),
    -- Type of image ('product' or 'hero')
    image_type TEXT, -- Can add CHECK constraint later if needed
    -- 'static' or the name of the generation service (e.g., 'getimg.ai')
    source TEXT NOT NULL,
    -- Optional: The modified prompt sent to the generation service
    generation_prompt TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for efficient vector similarity search (HNSW is generally recommended)
CREATE INDEX ON images USING hnsw (embedding vector_cosine_ops);

-- Optional: Index for filtering by layout_hint (useful for hero image selection)
-- CREATE INDEX ON images (layout_hint) WHERE layout_hint IS NOT NULL;

-- Optional: Index for filtering by source
-- CREATE INDEX ON images (source);

-- Optional: Standard index for potential text searches on description
-- CREATE INDEX ON images USING gin (description gin_trgm_ops); 

CREATE TABLE generated_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    store_url TEXT NOT NULL,
    hero_image_url TEXT NOT NULL,
    is_starred BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);