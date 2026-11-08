import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { database, uploadsDirectory } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const db = database();
  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as { stored_name: string } | undefined;
  if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });
  await fs.unlink(path.join(uploadsDirectory(), asset.stored_name)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  db.prepare("DELETE FROM assets WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
