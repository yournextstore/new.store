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
    final_store_json JSONB NULL, -- Stores the complete JSON sent to YNS
    is_starred BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE store_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES generated_stores(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_email TEXT NULL, -- For easier debugging, matches generated_stores
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')), -- 'up' or 'down'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_user_store_vote UNIQUE (user_id, store_id)
);

-- Optional: Index for faster lookups if querying votes for a specific store
CREATE INDEX IF NOT EXISTS idx_store_votes_store_id ON store_votes(store_id);

-- Optional: Index for faster lookups of a user's votes (though covered by unique_user_store_vote for single lookups)
CREATE INDEX IF NOT EXISTS idx_store_votes_user_id ON store_votes(user_id);

-- Function to update updated_at timestamp on relevant tables
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table to track the status of generation jobs
CREATE TABLE generation_jobs (
  id            UUID PRIMARY KEY, -- Client-generated UUIDv4, used as jobId
  user_id       TEXT NOT NULL,    -- Identifies the user initiating the request
  status        TEXT NOT NULL CHECK (status IN ('queued', 'hero_ready', 'full_ready', 'failed')),
  hero_json     JSONB,            -- Stores the JSON for the Hero section (nullable)
  full_json     JSONB,            -- Stores the complete store JSON (nullable)
  store_url     TEXT,             -- URL of the generated store (set at 'full_ready', nullable)
  error_msg     TEXT,             -- Error message if status is 'failed' (nullable)
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Trigger to automatically update updated_at on row modification for generation_jobs
CREATE TRIGGER set_timestamp_generation_jobs
BEFORE UPDATE ON generation_jobs
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Optional: Index for querying by status, if frequent
-- CREATE INDEX idx_generation_jobs_status ON generation_jobs (status);

-- Optional: Index for querying by user_id, if frequent
-- CREATE INDEX idx_generation_jobs_user_id ON generation_jobs (user_id);