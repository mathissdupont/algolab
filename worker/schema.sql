CREATE TABLE IF NOT EXISTS submissions (
  id            TEXT PRIMARY KEY,
  problem_id    TEXT NOT NULL,
  problem_slug  TEXT NOT NULL,
  graph_version TEXT,
  graph_json    TEXT NOT NULL,
  verdict       TEXT NOT NULL,
  passed        INTEGER NOT NULL,
  total         INTEGER NOT NULL,
  total_steps   INTEGER NOT NULL,
  client_hash   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_submissions_client_time ON submissions (client_hash, created_at);
