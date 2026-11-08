import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { exportsDirectory, projectById } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const escapeXml = (text: string) => text.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character]!);

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!projectById(id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const title = escapeXml(typeof body.title === "string" ? body.title.trim().slice(0, 80) : "YOUR VIDEO TITLE");
  if (!title) return NextResponse.json({ error: "Thumbnail text is required." }, { status: 400 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#21183d"/><stop offset="1" stop-color="#7557f5"/></linearGradient></defs><rect width="1280" height="720" fill="url(#bg)"/><circle cx="1080" cy="90" r="290" fill="#ffffff" opacity=".08"/><circle cx="180" cy="760" r="360" fill="#bbaaff" opacity=".12"/><rect x="76" y="82" width="92" height="9" rx="4" fill="#a995ff"/><text x="76" y="340" fill="#fff" font-family="Arial,sans-serif" font-size="90" font-weight="700">${title}</text><text x="80" y="407" fill="#ddd5ff" font-family="Arial,sans-serif" font-size="27">AI VIDEO CREATOR</text></svg>`;
  const file = path.join(exportsDirectory(), `${id}-thumbnail.svg`);
  await fs.writeFile(file, svg, "utf8");
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="${id}-thumbnail.svg"` } });
}
