import { NextResponse } from "next/server";
import { projectById } from "@/lib/db";
import { makeSeo } from "@/lib/content";
import { generateAiText } from "@/lib/ai";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const project = projectById(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic : project.topic;
  const platform = typeof body.platform === "string" ? body.platform.slice(0, 30) : "YouTube";
  if (!process.env.AI_PROVIDER || process.env.AI_PROVIDER === "template") return NextResponse.json(makeSeo(topic, platform));
  try {
    const response = await generateAiText(
      "Return only a JSON object with title, description, hashtags (array), keywords (array), tags (array), caption, and suggestions (array). Provide helpful suggestions without claiming live search research.",
      `Create metadata for ${platform}. Topic: ${topic}`,
      true,
    );
    const generated = JSON.parse(response.text);
    if (typeof generated.title !== "string" || typeof generated.description !== "string") throw new Error("Missing required title or description.");
    return NextResponse.json({ mode: response.mode, platform, ...generated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI provider returned invalid SEO metadata." }, { status: 502 });
  }
}
