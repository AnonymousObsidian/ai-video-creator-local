import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { assetsForProject, database, exportsDirectory, projectById, uploadsDirectory } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const project = projectById(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  return NextResponse.json({ project, assets: assetsForProject(id) });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!projectById(id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid project update." }, { status: 400 });
  const fields: string[] = [];
  const values: (string | number)[] = [];
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 100);
    if (!name) return NextResponse.json({ error: "Project name cannot be empty." }, { status: 400 });
    fields.push("name = ?"); values.push(name);
  }
  if (typeof body.topic === "string") { fields.push("topic = ?"); values.push(body.topic.slice(0, 2000)); }
  if (typeof body.script === "string") { fields.push("script = ?"); values.push(body.script.slice(0, 50000)); }
  if (typeof body.repo_url === "string") {
    const repoUrl = body.repo_url.trim();
    if (repoUrl) {
      try {
        const parsed = new URL(repoUrl);
        const segments = parsed.pathname.split("/").filter(Boolean);
        if (parsed.protocol !== "https:" || parsed.hostname !== "github.com" || parsed.port || parsed.username || parsed.password || segments.length < 2 || !/^[\w.-]+$/.test(segments[0]) || !/^[\w.-]+$/.test(segments[1])) {
          return NextResponse.json({ error: "Repository URL must be a public GitHub owner/repository URL." }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Repository URL must be a public GitHub owner/repository URL." }, { status: 400 });
      }
    }
    fields.push("repo_url = ?"); values.push(repoUrl.slice(0, 500));
  }
  if (typeof body.repo_summary === "string") { fields.push("repo_summary = ?"); values.push(body.repo_summary.slice(0, 20000)); }
  if (["9:16", "16:9", "1:1"].includes(body.format)) { fields.push("format = ?"); values.push(body.format); }
  if (Number.isInteger(body.duration) && body.duration >= 5 && body.duration <= 600) { fields.push("duration = ?"); values.push(body.duration); }
  if (!fields.length) return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  fields.push("updated_at = ?"); values.push(new Date().toISOString()); values.push(id);
  database().prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return NextResponse.json({ project: projectById(id) });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!projectById(id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const assets = assetsForProject(id);
  for (const asset of assets) {
    await fs.unlink(path.join(uploadsDirectory(), asset.stored_name)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  const exportDirectory = exportsDirectory();
  for (const extension of [".mp4", "-thumbnail.svg"]) {
    await fs.unlink(path.join(/*turbopackIgnore: true*/ exportDirectory, `${id}${extension}`)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  database().prepare("DELETE FROM projects WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
