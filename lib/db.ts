import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Project = {
  id: string;
  name: string;
  topic: string;
  script: string;
  repo_url: string;
  repo_summary: string;
  format: string;
  duration: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Asset = {
  id: string;
  project_id: string;
  name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  created_at: string;
};

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "creator.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    script TEXT NOT NULL DEFAULT '',
    repo_url TEXT NOT NULL DEFAULT '',
    repo_summary TEXT NOT NULL DEFAULT '',
    format TEXT NOT NULL DEFAULT '9:16',
    duration INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);
db.transaction(() => {
  const projectColumns = new Set((db.pragma("table_info(projects)") as Array<{ name: string }>).map((column) => column.name));
  if (!projectColumns.has("repo_url")) db.exec("ALTER TABLE projects ADD COLUMN repo_url TEXT NOT NULL DEFAULT ''");
  if (!projectColumns.has("repo_summary")) db.exec("ALTER TABLE projects ADD COLUMN repo_summary TEXT NOT NULL DEFAULT ''");
})();

export function database() {
  db.pragma("foreign_keys = ON");
  return db;
}

export function projectById(id: string) {
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
}

export function assetsForProject(id: string) {
  return db.prepare("SELECT * FROM assets WHERE project_id = ? ORDER BY created_at DESC").all(id) as Asset[];
}

export function uploadsDirectory() {
  const directory = path.join(dataDir, "uploads");
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

export function exportsDirectory() {
  const directory = path.join(dataDir, "exports");
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}
