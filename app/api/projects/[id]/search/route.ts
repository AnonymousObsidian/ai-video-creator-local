import { NextResponse } from "next/server";
import { projectById } from "@/lib/db";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
type SearchItem = { title?: string; content?: string; url?: string };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  if (!projectById(id)) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 250) : "";
  if (!query) return NextResponse.json({ error: "Enter a search phrase." }, { status: 400 });
  if (!process.env.SEARXNG_URL) return NextResponse.json({ error: "Configure SEARXNG_URL in .env.local and restart the app to enable web search." }, { status: 503 });

  try {
    const endpoint = new URL("/search", process.env.SEARXNG_URL);
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("format", "json");
    const response = await fetch(endpoint, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return NextResponse.json({ error: `SearXNG request failed (${response.status}). Check its URL and JSON format settings.` }, { status: 502 });
    const result = await response.json() as { results?: SearchItem[] };
    if (!Array.isArray(result.results)) return NextResponse.json({ error: "SearXNG did not return JSON results. Enable JSON format in that instance." }, { status: 502 });
    const results = result.results.slice(0, 8).flatMap((item) => {
      if (typeof item.title !== "string" || typeof item.url !== "string") return [];
      try {
        const link = new URL(item.url);
        if (!["http:", "https:"].includes(link.protocol)) return [];
        return [{ title: item.title.slice(0, 250), url: link.toString(), snippet: (item.content || "").slice(0, 500) }];
      } catch {
        return [];
      }
    });
    return NextResponse.json({ query, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? `Web search failed: ${error.message}` : "Web search failed." }, { status: 502 });
  }
}
