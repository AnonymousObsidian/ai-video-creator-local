import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { assetsForProject, database, exportsDirectory, projectById, uploadsDirectory } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const command = process.env.FFMPEG_PATH || "ffmpeg";
    const child = spawn(/*turbopackIgnore: true*/ command, args, { windowsHide: true });
    let errorOutput = "";
    child.stderr.on("data", (chunk: Buffer) => { errorOutput = (errorOutput + chunk.toString()).slice(-5000); });
    child.once("error", (error) => {
      const code = "code" in error ? error.code : undefined;
      reject(new Error(code === "ENOENT" ? "FFmpeg was not found. Install FFmpeg and add it to PATH, or set FFMPEG_PATH in .env.local." : error.message));
    });
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg failed (exit ${code}): ${errorOutput.slice(-1200)}`)));
  });
}

export async function POST(_request: Request, { params }: Context) {
  const { id } = await params;
  const project = projectById(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const assets = assetsForProject(id);
  const visual = assets.find((asset) => asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/"));
  if (!visual) return NextResponse.json({ error: "Upload an image or video before rendering. Text-only projects need a visual asset." }, { status: 400 });
  const audio = assets.find((asset) => asset.mime_type.startsWith("audio/"));
  const source = path.join(uploadsDirectory(), visual.stored_name);
  const output = path.join(exportsDirectory(), `${id}.mp4`);
  const dimensions = project.format === "16:9" ? ["1280", "720"] : project.format === "1:1" ? ["1080", "1080"] : ["720", "1280"];
  const scale = `scale=${dimensions[0]}:${dimensions[1]}:force_original_aspect_ratio=increase,crop=${dimensions[0]}:${dimensions[1]},setsar=1`;
  const args = ["-y"];
  if (visual.mime_type.startsWith("image/")) args.push("-loop", "1", "-framerate", "30");
  args.push("-i", source);
  if (audio) args.push("-i", path.join(uploadsDirectory(), audio.stored_name));
  args.push("-t", String(project.duration), "-vf", scale, "-r", "30", "-map", "0:v:0");
  if (audio) args.push("-map", "1:a:0");
  else if (visual.mime_type.startsWith("video/")) args.push("-map", "0:a?");
  args.push("-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p");
  if (audio || visual.mime_type.startsWith("video/")) args.push("-c:a", "aac", "-b:a", "128k");
  args.push("-movflags", "+faststart", output);
  database().prepare("UPDATE projects SET status = 'processing', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  try {
    await runFfmpeg(args);
    database().prepare("UPDATE projects SET status = 'completed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return NextResponse.json({ ok: true, downloadUrl: `/api/projects/${id}/download`, message: "Video rendered successfully." });
  } catch (error) {
    database().prepare("UPDATE projects SET status = 'draft', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    try {
      await fs.unlink(output);
    } catch (cleanupError) {
      if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) {
        console.error("Could not remove incomplete video export:", cleanupError);
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Video rendering failed." }, { status: 500 });
  }
}
