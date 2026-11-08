import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { database, projectById, uploadsDirectory } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const fileTypes: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/x-msvideo",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".pdf": "application/pdf",
  ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain", ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const maxBytes = 100 * 1024 * 1024;
const maxBatchBytes = 250 * 1024 * 1024;

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!projectById(id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const form = await request.formData();
  const uploads = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!uploads.length) return NextResponse.json({ error: "Choose at least one file to upload." }, { status: 400 });
  if (uploads.length > 20) return NextResponse.json({ error: "Upload no more than 20 files at a time." }, { status: 413 });
  if (uploads.some((file) => !fileTypes[path.extname(file.name).toLowerCase()])) return NextResponse.json({ error: "One or more files have an unsupported type." }, { status: 415 });
  if (uploads.some((file) => file.type && file.type !== "application/octet-stream" && file.type !== fileTypes[path.extname(file.name).toLowerCase()])) return NextResponse.json({ error: "A file's detected type does not match its extension." }, { status: 415 });
  if (uploads.some((file) => file.size > maxBytes)) return NextResponse.json({ error: "Each file must be 100 MB or smaller." }, { status: 413 });
  if (uploads.reduce((total, file) => total + file.size, 0) > maxBatchBytes) return NextResponse.json({ error: "A batch upload must be 250 MB or smaller." }, { status: 413 });
  const db = database();
  const added = [];
  for (const file of uploads) {
    const idForAsset = randomUUID();
    const extension = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 12);
    const storedName = `${idForAsset}${extension}`;
    await fs.writeFile(path.join(uploadsDirectory(), storedName), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    const created = new Date().toISOString();
    db.prepare("INSERT INTO assets (id, project_id, name, stored_name, mime_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(idForAsset, id, file.name.slice(0, 255), storedName, fileTypes[extension], file.size, created);
    added.push({ id: idForAsset, project_id: id, name: file.name, mime_type: fileTypes[extension], size: file.size, created_at: created });
  }
  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  return NextResponse.json({ assets: added }, { status: 201 });
}
