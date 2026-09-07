CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    leader_character_id TEXT,
    current_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id INTEGER NOT NULL,
    character_id TEXT NOT NULL,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL DEFAULT '',
    stand_name TEXT NOT NULL DEFAULT 'Stand não informado',
    part_name TEXT NOT NULL,
    character_role TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (team_id, character_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (team_id, version_number),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_versions_team_id
ON team_versions(team_id, version_number DESC);
