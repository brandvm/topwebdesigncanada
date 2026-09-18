CREATE TABLE IF NOT EXISTS review_threads (
 id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL UNIQUE,
 page TEXT NOT NULL, scope TEXT NOT NULL, commit_id TEXT NOT NULL,
 viewport_width INTEGER NOT NULL, viewport_height INTEGER NOT NULL,
 anchor TEXT NOT NULL, anchor_label TEXT NOT NULL,
 x INTEGER NOT NULL, y INTEGER NOT NULL, width INTEGER NOT NULL DEFAULT 0, height INTEGER NOT NULL DEFAULT 0,
 selection_type TEXT NOT NULL DEFAULT 'point',created_at INTEGER NOT NULL,
 resolved INTEGER NOT NULL DEFAULT 0,resolved_by TEXT,resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS review_threads_page_scope ON review_threads(page,scope,id);
CREATE TABLE IF NOT EXISTS review_messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,request_id TEXT NOT NULL UNIQUE,
 thread_id INTEGER NOT NULL REFERENCES review_threads(id) ON DELETE CASCADE,
 visitor_id TEXT NOT NULL,name TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS review_messages_thread ON review_messages(thread_id,id);
CREATE TABLE IF NOT EXISTS review_reactions (
 message_id INTEGER NOT NULL REFERENCES review_messages(id) ON DELETE CASCADE,
 visitor_id TEXT NOT NULL,emoji TEXT NOT NULL,PRIMARY KEY(message_id,visitor_id,emoji)
);
CREATE TABLE IF NOT EXISTS review_rate_limits (key TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL);
