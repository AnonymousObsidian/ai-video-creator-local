import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { database, uploadsDirectory } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const asset = database().prepare("SELECT * FROM assets WHERE id = ?").get(id) as { name: string; stored_name: string; mime_type: string } | undefined;
  if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });
  try {
    const file = await fs.readFile(path.join(uploadsDirectory(), asset.stored_name));
    return new NextResponse(file, { headers: { "Content-Type": asset.mime_type, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`, "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "Uploaded file is missing from local storage." }, { status: 404 });
  }
}
