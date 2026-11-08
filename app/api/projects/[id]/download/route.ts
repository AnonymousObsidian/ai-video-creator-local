import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { exportsDirectory, projectById } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!projectById(id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  try {
    const video = await fs.readFile(path.join(exportsDirectory(), `${id}.mp4`));
    const preview = new URL(_request.url).searchParams.get("preview") === "1";
    return new NextResponse(video, { headers: { "Content-Type": "video/mp4", "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="video-${id}.mp4"` } });
  } catch {
    return NextResponse.json({ error: "No rendered video is available yet." }, { status: 404 });
  }
}
