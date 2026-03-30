-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name  text,
  created_at    timestamptz DEFAULT now()
);

-- Add user ownership + community columns to songs
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

-- Add user ownership to setlists
ALTER TABLE setlists
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Song likes (prevents double-liking)
CREATE TABLE IF NOT EXISTS song_likes (
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  song_id    text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

-- Index for community queries
CREATE INDEX IF NOT EXISTS idx_songs_is_public ON songs(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_songs_user_id ON songs(user_id);
