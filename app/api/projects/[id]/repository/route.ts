import { NextResponse } from "next/server";
import { database, projectById } from "@/lib/db";
import { generateAiText } from "@/lib/ai";
import { makeLaunchScript } from "@/lib/content";

export const runtime = "nodejs";
export const maxDuration = 90;
type Context = { params: Promise<{ id: string }> };
type GitHubRepo = { full_name: string; name: string; html_url: string; description: string | null; default_branch: string; language: string | null };
type GitHubTreeEntry = { path: string; type: string; size?: number };

async function githubJson(url: string, accept = "application/vnd.github+json") {
  const response = await fetch(url, {
    headers: { Accept: accept, "User-Agent": "AI-Video-Creator-local-app", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("Public repository or file not found. Check the URL and confirm the repository is public.");
    if (response.status === 403 || response.status === 429) throw new Error("GitHub rate limit reached. Wait a little and try again.");
    throw new Error(`GitHub request failed (${response.status}).`);
  }
  return response;
}

function decodeContent(entry: { encoding?: string; content?: string }) {
  if (entry.encoding !== "base64" || typeof entry.content !== "string") return "";
  return Buffer.from(entry.content, "base64").toString("utf8").slice(0, 20000);
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const project = projectById(id);
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const input = typeof body?.url === "string" ? body.url.trim() : "";
  let url: URL;
  try { url = new URL(input); } catch { return NextResponse.json({ error: "Enter a valid public GitHub repository URL." }, { status: 400 }); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.port || url.username || url.password) {
    return NextResponse.json({ error: "Only public https://github.com/{owner}/{repository} URLs are supported." }, { status: 400 });
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || !/^[\w.-]+$/.test(segments[0]) || !/^[\w.-]+$/.test(segments[1])) {
    return NextResponse.json({ error: "Use a repository URL in the form https://github.com/owner/repository." }, { status: 400 });
  }
  const owner = segments[0];
  const repoName = segments[1].replace(/\.git$/i, "");
  const apiRoot = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`;

  try {
    const repoResponse = await githubJson(apiRoot);
    const repo = await repoResponse.json() as GitHubRepo;
    const treeResponse = await githubJson(`${apiRoot}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`);
    const treeText = await treeResponse.text();
    if (treeText.length > 2_000_000) throw new Error("Repository file tree is too large to inspect safely. Try a smaller repository.");
    const treeResult = JSON.parse(treeText) as { tree?: GitHubTreeEntry[]; truncated?: boolean };
    const entries = treeResult.tree ?? [];
    const readmePath = entries.find((entry) => entry.type === "blob" && (entry.size ?? 0) <= 50000 && /^readme(?:\.[^/]*)?$/i.test(entry.path))?.path;
    const manifests = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "requirements.txt", "composer.json"];
    const manifestPath = manifests.find((manifest) => entries.some((entry) => entry.type === "blob" && (entry.size ?? 0) <= 20000 && entry.path.toLowerCase() === manifest));
    const sourcePath = entries.find((entry) => entry.type === "blob" && (entry.size ?? 0) <= 15000 && /^(src|app|lib)\//i.test(entry.path) && /\.(ts|tsx|js|jsx|py|go|rs)$/i.test(entry.path))?.path;
    const paths = [...new Set([readmePath, manifestPath, sourcePath].filter((path): path is string => !!path))];
    const fileTexts = await Promise.all(paths.map(async (filePath) => {
      const response = await githubJson(`${apiRoot}/contents/${filePath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(repo.default_branch)}`);
      const file = await response.json() as { encoding?: string; content?: string };
      return { path: filePath, text: decodeContent(file) };
    }));
    const readme = fileTexts.find((file) => file.path === readmePath)?.text ?? "";
    const manifest = fileTexts.find((file) => file.path === manifestPath)?.text ?? "";
    const source = fileTexts.find((file) => file.path === sourcePath)?.text ?? "";
    const description = repo.description || `${repo.name} open-source repository`;
    const summary = [
      `Repository: ${repo.full_name}`,
      `URL: ${repo.html_url}`,
      `Description: ${description}`,
      `Primary language: ${repo.language || "Not specified"}`,
      `Default branch: ${repo.default_branch}`,
      `README excerpt:\n${readme.slice(0, 6000)}`,
      manifest ? `Project manifest (${manifestPath}):\n${manifest.slice(0, 6000)}` : "",
      source ? `Sample source file (${sourcePath}):\n${source.slice(0, 3000)}` : "",
    ].filter(Boolean).join("\n\n").slice(0, 14000);

    let script: string;
    let mode = "offline-template";
    if (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "template") {
      const generated = await generateAiText(
        "You create accurate product launch videos from public repository information. Produce a short, engaging spoken script with a hook, 3 labeled scenes, and a closing. Only claim features supported by the supplied README, manifest, or source excerpt. Say when a detail is unclear.",
        `Create an approximately 30-second repository launch video script from this read-only repository research:\n\n${summary}`,
      );
      script = generated.text;
      mode = generated.mode;
    } else {
      script = makeLaunchScript(repo.name, description, repo.language || "", readme);
    }

    const topic = `${repo.name}: ${description}`.slice(0, 2000);
    const now = new Date().toISOString();
    database().prepare("UPDATE projects SET repo_url = ?, repo_summary = ?, topic = ?, script = ?, updated_at = ? WHERE id = ?")
      .run(repo.html_url, summary, topic, script, now, id);
    return NextResponse.json({
      mode,
      repo: { name: repo.full_name, url: repo.html_url, description, language: repo.language, filesRead: fileTexts.filter((file) => file.text).map((file) => file.path), treeTruncated: Boolean(treeResult.truncated) },
      summary,
      script,
      notice: `Read public repository documentation and selected text files only. No repository code was run. Script source: ${mode === "offline-template" ? "offline writing template (not an AI model)" : mode}.`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Repository analysis failed." }, { status: 502 });
  }
}
