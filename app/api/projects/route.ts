import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { database } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = database();
  const projects = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM assets a WHERE a.project_id = p.id) AS asset_count
    FROM projects p ORDER BY updated_at DESC
  `).all();
  const completed = db.prepare("SELECT COUNT(*) AS count FROM projects WHERE status = 'completed'").get() as { count: number };
  const processing = db.prepare("SELECT COUNT(*) AS count FROM projects WHERE status = 'processing'").get() as { count: number };
  const assets = db.prepare("SELECT COUNT(*) AS count FROM assets").get() as { count: number };
  return NextResponse.json({ projects, stats: { projects: projects.length, completed: completed.count, processing: processing.count, assets: assets.count } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  const id = randomUUID();
  const now = new Date().toISOString();
  database().prepare("INSERT INTO projects (id, name, topic, script, format, duration, status, created_at, updated_at) VALUES (?, ?, ?, '', '9:16', 30, 'draft', ?, ?)")
    .run(id, name, typeof body.topic === "string" ? body.topic.slice(0, 2000) : "", now, now);
  return NextResponse.json({ id, name }, { status: 201 });
}
