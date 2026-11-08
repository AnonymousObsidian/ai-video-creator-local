import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { assetsForProject, database, projectById, uploadsDirectory } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Context) {
  const { id } = await params;
  const project = projectById(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const newId = randomUUID();
  const now = new Date().toISOString();
  const copiedAssets: Array<{ id: string; name: string; stored_name: string; mime_type: string; size: number; created_at: string }> = [];
  try {
    for (const asset of assetsForProject(id)) {
      const newAssetId = randomUUID();
      const extension = path.extname(asset.stored_name);
      const storedName = `${newAssetId}${extension}`;
      await fs.copyFile(path.join(uploadsDirectory(), asset.stored_name), path.join(uploadsDirectory(), storedName));
      copiedAssets.push({ id: newAssetId, name: asset.name, stored_name: storedName, mime_type: asset.mime_type, size: asset.size, created_at: now });
    }

    const db = database();
    db.transaction(() => {
      db.prepare(`INSERT INTO projects (id, name, topic, script, repo_url, repo_summary, format, duration, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`)
        .run(newId, `${project.name} (copy)`.slice(0, 100), project.topic, project.script, project.repo_url, project.repo_summary, project.format, project.duration, now, now);
      const insertAsset = db.prepare("INSERT INTO assets (id, project_id, name, stored_name, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
      for (const asset of copiedAssets) insertAsset.run(asset.id, newId, asset.name, asset.stored_name, asset.mime_type, asset.size, asset.created_at);
    })();
    return NextResponse.json({ id: newId, name: `${project.name} (copy)`.slice(0, 100) }, { status: 201 });
  } catch (error) {
    await Promise.all(copiedAssets.map(async (asset) => {
      try { await fs.unlink(path.join(uploadsDirectory(), asset.stored_name)); }
      catch (cleanupError) {
        if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) console.error("Could not clean up duplicated upload:", cleanupError);
      }
    }));
    return NextResponse.json({ error: error instanceof Error ? `Could not duplicate project: ${error.message}` : "Could not duplicate project." }, { status: 500 });
  }
}
