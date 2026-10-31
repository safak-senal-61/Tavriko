-- ============================================================================
-- TriviaVerse Production PostgreSQL Schema for Supabase
-- Includes RLS policies, indexing, and strict review workflows
-- ============================================================================

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Sparkles',
  primary_color TEXT NOT NULL DEFAULT '#6366F1',
  accent_color TEXT NOT NULL DEFAULT '#A5B4FC',
  total_questions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  sub_category TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
  text TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of { id, text }
  correct_option_id TEXT NOT NULL,
  explanation TEXT NOT NULL,
  source_or_verification TEXT,
  language TEXT NOT NULL DEFAULT 'tr',
  content_hash TEXT UNIQUE NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review', 'approved', 'published', 'rejected')),
  time_limit_sec INTEGER NOT NULL DEFAULT 15,
  model_metadata JSONB,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & anti-repeat sampling
CREATE INDEX IF NOT EXISTS idx_questions_category_diff_status ON questions(category_id, difficulty, review_status);
CREATE INDEX IF NOT EXISTS idx_questions_review_status ON questions(review_status);
CREATE INDEX IF NOT EXISTS idx_questions_content_hash ON questions(content_hash);

-- 3. Matches Table
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  mode TEXT NOT NULL,
  category_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'finished',
  total_rounds INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_matches_room_code ON matches(room_code);

-- 4. Match Players Table
CREATE TABLE IF NOT EXISTS match_players (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 1,
  correct_count INTEGER NOT NULL DEFAULT 0,
  avg_response_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Match Answers (Audit Trail)
CREATE TABLE IF NOT EXISTS match_answers (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  selected_option_id TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  points_earned INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_answers_match_player ON match_answers(match_id, player_id);

-- 6. Telegram Review History Table
CREATE TABLE IF NOT EXISTS review_history (
  id BIGSERIAL PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'edit', 'regenerate', 'verify')),
  reviewed_by TEXT NOT NULL,
  rejection_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_history_question ON review_history(question_id);

-- ============================================================================
-- Row Level Security (RLS) Configuration
-- ============================================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;

-- Categories: Public read allowed
CREATE POLICY categories_public_read ON categories
  FOR SELECT USING (true);

-- Questions: Public can ONLY read published questions
CREATE POLICY questions_published_public_read ON questions
  FOR SELECT USING (review_status = 'published');

-- Matches: Public read and insert allowed for active gameplay
CREATE POLICY matches_public_insert ON matches
  FOR INSERT WITH CHECK (true);
CREATE POLICY matches_public_read ON matches
  FOR SELECT USING (true);

-- Match Players & Answers: Public insert/read for participants
CREATE POLICY match_players_public_all ON match_players
  FOR ALL USING (true);
CREATE POLICY match_answers_public_all ON match_answers
  FOR ALL USING (true);

-- Review History: Service role only (admins)
CREATE POLICY review_history_service_role ON review_history
  FOR ALL USING (auth.role() = 'service_role');
