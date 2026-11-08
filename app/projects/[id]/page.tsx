"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Clapperboard, Download, FileAudio, FileImage, FileText, FileVideo, Film, LoaderCircle, Music2, Save, Sparkles, Trash2, Upload, WandSparkles } from "lucide-react";
import AppShell from "@/components/AppShell";

type Project = { id: string; name: string; topic: string; script: string; repo_url: string; repo_summary: string; format: string; duration: number; status: string };
type Asset = { id: string; name: string; mime_type: string; size: number };
type SeoResult = { mode: string; platform: string; title: string; description: string; hashtags: string[]; keywords: string[]; tags: string[]; caption: string; suggestions: string[] };
type SearchResult = { title: string; url: string; snippet: string };
type Tab = "editor" | "seo" | "thumbnail";

export default function ProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tab, setTab] = useState<Tab>("editor");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [seo, setSeo] = useState<SeoResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [platform, setPlatform] = useState("YouTube");
  const [thumbnailText, setThumbnailText] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [rendered, setRendered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${id}`, { signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load project.");
      setLoadError("");
      setProject(data.project);
      setAssets(data.assets);
      setThumbnailText((current) => current || data.project.topic || data.project.name);
      setRendered(data.project.status === "completed");
    } catch (error) {
      const message = error instanceof DOMException && error.name === "TimeoutError"
        ? "Loading took too long. Confirm the local server is running, then reload this page."
        : error instanceof Error ? error.message : "Could not load project.";
      setLoadError(message); setToast(message);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "editor" || requestedTab === "seo" || requestedTab === "thumbnail") setTab(requestedTab);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => { if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl); }, [thumbnailUrl]);

  const visual = assets.find((asset) => asset.mime_type.startsWith("image/") || asset.mime_type.startsWith("video/"));
  const scenes = useMemo(() => (project?.script || "").split(/\n+/).map((text) => text.replace(/^(Hook|Scene \d+|Closing):\s*/i, "").trim()).filter(Boolean), [project?.script]);

  function updateProject(field: keyof Pick<Project, "name" | "topic" | "script" | "repo_url" | "repo_summary" | "format" | "duration">, value: string | number) {
    setProject((current) => current ? { ...current, [field]: value } : current);
  }
  function selectTab(nextTab: Tab) {
    setTab(nextTab);
    window.history.replaceState(null, "", `/projects/${id}?tab=${nextTab}`);
  }
  async function saveProject() {
    if (!project) return;
    setBusy("save");
    try {
      const response = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: project.name, topic: project.topic, script: project.script, repo_url: project.repo_url, repo_summary: project.repo_summary, format: project.format, duration: project.duration }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save project.");
      setProject(result.project);
      setToast("Project saved on this computer.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Could not save project."); }
    finally { setBusy(""); }
  }
  function uploadFiles(list: FileList | File[]) {
    if (!list.length) return;
    setBusy("upload"); setProgress(0);
    const form = new FormData();
    Array.from(list).forEach((file) => form.append("files", file));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/projects/${id}/assets`);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => {
      let result: { error?: string; assets?: Asset[] } = {};
      try { result = JSON.parse(xhr.responseText || "{}"); } catch { result = { error: "The server returned an invalid upload response." }; }
      if (xhr.status < 200 || xhr.status >= 300) setToast(result.error || "Upload failed.");
      else { const uploaded = result.assets ?? []; setAssets((current) => [...uploaded, ...current]); setToast(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded locally.`); }
      setBusy(""); setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    };
    xhr.onerror = () => { setToast("Network error while uploading files."); setBusy(""); setProgress(0); };
    xhr.send(form);
  }
  async function deleteAsset(asset: Asset) {
    try {
      const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not remove file.");
      setAssets((current) => current.filter((entry) => entry.id !== asset.id));
      setToast("File removed.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Could not remove file."); }
  }
  async function generateScript() {
    if (!project) return;
    setBusy("script");
    try {
      const textFile = assets.find((asset) => asset.mime_type === "text/plain");
      const source = textFile ? await (await fetch(`/api/assets/${textFile.id}/file`)).text() : "";
      const response = await fetch(`/api/projects/${id}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: project.topic, source }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create a script.");
      setProject((current) => current ? { ...current, script: result.script } : current);
      setToast(result.notice);
    } catch (error) { setToast(error instanceof Error ? error.message : "Could not create a script."); }
    finally { setBusy(""); }
  }
  async function generateSeo() {
    if (!project) return;
    setBusy("seo");
    try {
      const response = await fetch(`/api/projects/${id}/seo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: project.topic, platform }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not prepare SEO text.");
      setSeo(result);
    } catch (error) { setToast(error instanceof Error ? error.message : "Could not prepare SEO text."); }
    finally { setBusy(""); }
  }
  async function analyzeRepository() {
    if (!project?.repo_url.trim()) { setToast("Enter a public GitHub repository URL first."); return; }
    setBusy("repository");
    try {
      const response = await fetch(`/api/projects/${id}/repository`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: project.repo_url }),
        signal: AbortSignal.timeout(90000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Repository analysis failed.");
      setProject((current) => current ? { ...current, repo_url: result.repo.url, repo_summary: result.summary, topic: `${result.repo.name}: ${result.repo.description}`, script: result.script } : current);
      setToast(result.notice);
    } catch (error) {
      setToast(error instanceof DOMException && error.name === "TimeoutError"
        ? "Repository analysis timed out. Try a smaller public repository or retry."
        : error instanceof Error ? error.message : "Repository analysis failed.");
    } finally { setBusy(""); }
  }
  async function searchWeb() {
    if (!searchQuery.trim()) { setToast("Enter a search phrase first."); return; }
    setBusy("search");
    try {
      const response = await fetch(`/api/projects/${id}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Web search failed.");
      setSearchResults(result.results);
      if (!result.results.length) setToast("No results found. Try a different phrase.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Web search failed.");
    } finally { setBusy(""); }
  }
  function useSearchResult(result: SearchResult) {
    updateProject("topic", `${project?.topic || ""}\n\nResearch: ${result.title}\n${result.snippet}\nSource: ${result.url}`.trim());
    setToast("Added research to the project brief. Save the project to keep it.");
  }
  async function createThumbnail() {
    setBusy("thumbnail");
    try {
      const response = await fetch(`/api/projects/${id}/thumbnail`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: thumbnailText }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Could not make thumbnail."); }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      setThumbnailUrl((current) => { if (current) URL.revokeObjectURL(current); return downloadUrl; });
      const link = document.createElement("a"); link.href = downloadUrl; link.download = "ai-video-thumbnail.svg"; link.click();
      setToast("Thumbnail created and downloaded as SVG.");
    } catch (error) { setToast(error instanceof Error ? error.message : "Could not make thumbnail."); }
    finally { setBusy(""); }
  }
  async function renderVideo() {
    setBusy("render");
    try {
      const response = await fetch(`/api/projects/${id}/render`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Render failed.");
      setRendered(true); setProject((current) => current ? { ...current, status: "completed" } : current); setToast(result.message);
    } catch (error) { setToast(error instanceof Error ? error.message : "Render failed."); }
    finally { setBusy(""); }
  }
  function downloadCaptions() {
    const parts = scenes.map((scene, index) => {
      const start = index * Math.floor((project?.duration ?? 30) / Math.max(scenes.length, 1));
      const end = index === scenes.length - 1 ? project?.duration ?? 30 : (index + 1) * Math.floor((project?.duration ?? 30) / Math.max(scenes.length, 1));
      const stamp = (seconds: number) => `00:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")},000`;
      return `${index + 1}\n${stamp(start)} --> ${stamp(end)}\n${scene}\n`;
    });
    downloadText(parts.join("\n"), "captions.srt", "text/plain");
  }
  if (!project) return <AppShell section="Video Editor" projectId={id}><div className="content"><div className="card empty">{loadError ? <><div style={{ color: "var(--text)", marginBottom: 8 }}>{loadError}</div><Link className="btn" href="/">Return to projects</Link></> : <><LoaderCircle size={18} className="animate-spin" /> Loading project…</>}</div></div>{toast && <div className="toast">{toast}</div>}</AppShell>;

  return <AppShell section={tab === "seo" ? "SEO Studio" : tab === "thumbnail" ? "Thumbnail Studio" : "Video Editor"} projectId={id}>
    <div className="content">
      <div className="header-row">
        <div><Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted)", textDecoration: "none", fontSize: 12, marginBottom: 8 }}><ArrowLeft size={14} /> All projects</Link><input aria-label="Project name" value={project.name} onChange={(event) => updateProject("name", event.target.value)} className="input" style={{ maxWidth: 430, fontSize: 22, fontWeight: 700, padding: "5px 8px", letterSpacing: "-.5px" }} /><p className="subtitle">Your working space for script, assets and exports.</p></div>
        <button className="btn btn-primary" onClick={() => void saveProject()} disabled={busy !== ""}><Save size={15} />{busy === "save" ? "Saving…" : "Save project"}</button>
      </div>
      <div className="toolbar" style={{ marginBottom: 18 }}>
        <button className={`btn ${tab === "editor" ? "btn-primary" : ""}`} onClick={() => selectTab("editor")}><Film size={15} /> Video editor</button>
        <button className={`btn ${tab === "seo" ? "btn-primary" : ""}`} onClick={() => selectTab("seo")}><Sparkles size={15} /> SEO tools</button>
        <button className={`btn ${tab === "thumbnail" ? "btn-primary" : ""}`} onClick={() => selectTab("thumbnail")}><FileImage size={15} /> Thumbnail</button>
      </div>
      {tab === "editor" && <div className="editor-grid">
        <div style={{ display: "grid", gap: 14 }}>
          <section className="card panel">
            <h2>Project setup</h2>
            <div className="field"><label htmlFor="topic">Topic, URL or content brief</label><textarea id="topic" className="textarea" style={{ minHeight: 82 }} placeholder="Example: Make a 30-second upbeat beginner guide for new gardeners. Explain 3 easy steps, use friendly language, and finish with ‘follow for more’." value={project.topic} onChange={(event) => updateProject("topic", event.target.value)} /><span style={{ color: "var(--muted)", fontSize: 11 }}>Prompt tip: include audience + goal + tone + key points + call to action. A URL is saved as context only; use Web research to search it.</span></div>
            <div className="field"><label>Video format</label><div className="format-options">{(["9:16", "16:9", "1:1"] as const).map((format) => <button key={format} className={`format-option ${project.format === format ? "selected" : ""}`} onClick={() => updateProject("format", format)}>{format}<br /><span style={{ fontSize: 9 }}>{format === "9:16" ? "Vertical" : format === "16:9" ? "Landscape" : "Square"}</span></button>)}</div></div>
            <div className="field"><label htmlFor="duration">Duration</label><select id="duration" className="select" value={[15, 30, 60, 180, 300].includes(project.duration) ? project.duration : "custom"} onChange={(event) => updateProject("duration", event.target.value === "custom" ? (project.duration > 300 || ![15, 30, 60, 180, 300].includes(project.duration) ? project.duration : 45) : Number(event.target.value))}>{[15, 30, 60, 180, 300].map((seconds) => <option key={seconds} value={seconds}>{seconds < 60 ? `${seconds} seconds` : `${seconds / 60} minute${seconds === 60 ? "" : "s"}`}</option>)}<option value="custom">Custom duration</option></select>{![15, 30, 60, 180, 300].includes(project.duration) && <input aria-label="Custom duration in seconds" className="input" type="number" min={5} max={600} value={project.duration} onChange={(event) => updateProject("duration", Number(event.target.value))} />}</div>
            <div className="toolbar"><button className="btn btn-primary" onClick={() => void generateScript()} disabled={busy !== ""}><WandSparkles size={15} />{busy === "script" ? "Preparing…" : "Draft script"}</button>{project.script && <button className="btn" onClick={downloadCaptions}><FileText size={15} />Export captions (.srt)</button>}</div>
          </section>
          <section className="card panel">
            <h2>Public GitHub → launch video</h2>
            <p className="subtitle" style={{ fontSize: 12, marginBottom: 12 }}>Read public repository docs and selected text files to draft an intro or launch script. Repository code is never executed or tested.</p>
            <div className="field"><label htmlFor="repository-url">Public repository URL</label><input id="repository-url" className="input" placeholder="https://github.com/owner/repository" value={project.repo_url} onChange={(event) => updateProject("repo_url", event.target.value)} /></div>
            <button className="btn btn-primary" onClick={() => void analyzeRepository()} disabled={busy !== ""}><Sparkles size={15} />{busy === "repository" ? "Reading repository…" : "Read repo & draft launch script"}</button>
            {project.repo_summary && <details style={{ marginTop: 13 }}><summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: 12 }}>View read-only research summary</summary><pre className="result-box" style={{ whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto" }}>{project.repo_summary}</pre></details>}
          </section>
          <section className="card panel">
            <h2>Web research</h2>
            <p className="subtitle" style={{ fontSize: 12, marginBottom: 12 }}>Search the web through your configured SearXNG instance, then add useful results to the project brief.</p>
            <div className="field"><label htmlFor="search-query">Search phrase</label><input id="search-query" className="input" placeholder="e.g. background facts for my video" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchWeb(); } }} /></div>
            <button className="btn" onClick={() => void searchWeb()} disabled={busy !== ""}><Sparkles size={15} />{busy === "search" ? "Searching…" : "Search web"}</button>
            {!!searchResults.length && <div className="asset-list">{searchResults.map((result) => <article className="asset-row" key={result.url} style={{ alignItems: "flex-start" }}><span style={{ flex: 1, minWidth: 0 }}><a href={result.url} target="_blank" rel="noreferrer" style={{ color: "#b9aaff", fontWeight: 600 }}>{result.title}</a><span style={{ display: "block", color: "var(--muted)", fontSize: 11, marginTop: 5 }}>{result.snippet}</span></span><button className="btn" onClick={() => useSearchResult(result)}>Use</button></article>)}</div>}
          </section>
          <section className="card panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h2>Script & scenes</h2>{scenes.length > 0 && <span className="pill pill-draft">{scenes.length} scenes</span>}</div>
            <textarea className="textarea" aria-label="Video script" placeholder="Write or generate your video script here…" value={project.script} onChange={(event) => updateProject("script", event.target.value)} />
            <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 8 }}>Voice generation is not included in offline mode. Upload an audio track to include it in the FFmpeg export.</div>
          </section>
          <section className="card panel">
            <h2>Media library</h2>
            <div className={`dropzone ${dragging ? "dragover" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); uploadFiles(event.dataTransfer.files); }}>
              <Upload size={23} style={{ color: "#b5a4ff", marginBottom: 8 }} /><div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 5 }}>Drag files here, or browse</div><div style={{ fontSize: 11 }}>Images, video, audio, PDF, Word, text and PowerPoint · max 100 MB each</div>
              <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => inputRef.current?.click()} disabled={busy === "upload"}><Upload size={14} />Choose files</button>
              <input ref={inputRef} className="hidden-input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.avi,.mp3,.wav,.pdf,.doc,.docx,.txt,.ppt,.pptx" onChange={(event) => { if (event.target.files) uploadFiles(event.target.files); }} />
              {busy === "upload" && <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>}
            </div>
            {assets.length ? <div className="asset-list">{assets.map((asset) => <AssetRow key={asset.id} asset={asset} onDelete={() => void deleteAsset(asset)} />)}</div> : <div style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", marginTop: 13 }}>Uploaded files stay in the local data/uploads folder.</div>}
          </section>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <section className="card panel"><h2>Preview</h2>
            <div className={`preview ${project.format === "16:9" ? "landscape" : project.format === "1:1" ? "square" : ""}`}>
              {rendered ? <video controls src={`/api/projects/${id}/download?preview=1`} /> : visual ? visual.mime_type.startsWith("image/") ? <img src={`/api/assets/${visual.id}/file`} alt={visual.name} /> : <video controls src={`/api/assets/${visual.id}/file`} /> : <div className="preview-empty"><Clapperboard size={30} style={{ marginBottom: 10, color: "#a38fff" }} /><div>Add a photo or video to preview your project</div></div>}
            </div>
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 13 }} onClick={() => void renderVideo()} disabled={busy !== "" || !visual}><Clapperboard size={15} />{busy === "render" ? "Rendering…" : "Render video (FFmpeg)"}</button>
            {rendered && <a className="btn" style={{ width: "100%", marginTop: 8 }} href={`/api/projects/${id}/download`}><Download size={15} />Download MP4</a>}
            <div style={{ color: "var(--muted)", fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>Offline export uses one visual asset, your selected aspect ratio and duration. Add an audio file to include a soundtrack.</div>
          </section>
          <section className="card panel"><h2>Voice & music</h2><div className="asset-row"><span className="asset-kind"><Music2 size={16} /></span><span className="asset-name">Background audio</span><span className="asset-size">{assets.some((asset) => asset.mime_type.startsWith("audio/")) ? "Included in render" : "Upload an audio file"}</span></div><div className="asset-row" style={{ marginTop: 8 }}><span className="asset-kind"><Sparkles size={16} /></span><span className="asset-name">Text-to-speech</span><span className="pill pill-draft">Unavailable offline</span></div></section>
          {rendered && <section className="card panel"><h2>Export ready</h2><div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>Your video was rendered locally and is ready to download.</div><a className="btn btn-primary" href={`/api/projects/${id}/download`}><Download size={15} />Download MP4</a></section>}
        </div>
      </div>}
      {tab === "seo" && <div className="editor-grid">
        <section className="card panel"><h2>Search-friendly metadata</h2><p className="subtitle" style={{ fontSize: 12 }}>Create editable title, description, tags and captions with an offline template. These suggestions are not AI-generated or based on live search data.</p>
          <div className="field"><label htmlFor="platform">Platform</label><select id="platform" className="select" value={platform} onChange={(event) => setPlatform(event.target.value)}>{["YouTube", "Instagram", "TikTok", "Facebook"].map((item) => <option key={item}>{item}</option>)}</select></div>
          <button className="btn btn-primary" onClick={() => void generateSeo()} disabled={busy !== ""}><Sparkles size={15} />{busy === "seo" ? "Preparing…" : "Prepare SEO suggestions"}</button>
          {seo && <div className="result-box"><div style={{ marginBottom: 10 }}><span className="pill pill-draft">{seo.mode}</span></div><h3>{seo.title}</h3><div>{seo.description}</div><h3 style={{ marginTop: 17 }}>Caption</h3><div>{seo.caption}</div><h3 style={{ marginTop: 17 }}>Hashtags</h3><div>{seo.hashtags.map((tag) => <span className="result-tag" key={tag}>{tag}</span>)}</div><h3 style={{ marginTop: 17 }}>Keywords & tags</h3><div>{seo.tags.map((tag) => <span className="result-tag" key={tag}>{tag}</span>)}</div><h3 style={{ marginTop: 17 }}>Suggestions</h3><ul style={{ paddingLeft: 19, marginBottom: 0 }}>{seo.suggestions.map((tip) => <li key={tip}>{tip}</li>)}</ul><button className="btn" style={{ marginTop: 14 }} onClick={() => downloadText(`${seo.title}\n\n${seo.description}\n\n${seo.caption}\n\n${seo.hashtags.join(" ")}\n\nTags: ${seo.tags.join(", ")}`, "video-seo.txt", "text/plain")}><Download size={14} />Download text</button></div>}
        </section>
        <section className="card panel"><h2>SEO checklist</h2>{["Say what viewers will learn in the title.", "Keep the first lines of your description useful.", "Use relevant tags; avoid unrelated trending terms.", "Review platform-specific caption length.", "Check that the thumbnail remains legible on mobile."].map((text, index) => <div key={text} className="asset-row"><span className="asset-kind"><Check size={15} /></span><span className="asset-name">{text}</span><span className="asset-size">Tip {index + 1}</span></div>)}</section>
      </div>}
      {tab === "thumbnail" && <div className="editor-grid">
        <section className="card panel"><h2>Thumbnail maker</h2><p className="subtitle" style={{ fontSize: 12 }}>Create an editable SVG cover locally. This template does not generate images with AI or remove backgrounds.</p><div className="field"><label htmlFor="thumbnail-title">Thumbnail text</label><input id="thumbnail-title" className="input" value={thumbnailText} maxLength={80} onChange={(event) => setThumbnailText(event.target.value)} /></div><button className="btn btn-primary" onClick={() => void createThumbnail()} disabled={busy !== "" || !thumbnailText.trim()}><WandSparkles size={15} />{busy === "thumbnail" ? "Creating…" : "Create & download SVG"}</button>{thumbnailUrl && <div style={{ marginTop: 16 }}><img src={thumbnailUrl} alt="Generated thumbnail" style={{ display: "block", width: "100%", borderRadius: 8 }} /></div>}</section>
        <section className="card panel"><h2>Uploaded images</h2><div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12 }}>Use the image preview in your video or download a template thumbnail above. Uploaded-image composition is not currently included.</div>{assets.filter((asset) => asset.mime_type.startsWith("image/")).map((asset) => <AssetRow key={asset.id} asset={asset} onDelete={() => void deleteAsset(asset)} />)}{!assets.some((asset) => asset.mime_type.startsWith("image/")) && <div className="empty" style={{ padding: 18 }}>No uploaded images yet.</div>}</section>
      </div>}
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
  </AppShell>;
}

function AssetRow({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
  const Icon = asset.mime_type.startsWith("image/") ? FileImage : asset.mime_type.startsWith("video/") ? FileVideo : asset.mime_type.startsWith("audio/") ? FileAudio : FileText;
  const size = asset.size < 1024 * 1024 ? `${Math.max(1, Math.round(asset.size / 1024))} KB` : `${(asset.size / 1024 / 1024).toFixed(1)} MB`;
  return <div className="asset-row"><span className="asset-kind"><Icon size={16} /></span><span className="asset-name" title={asset.name}>{asset.name}</span><span className="asset-size">{size}</span><button className="icon-button btn-danger" onClick={onDelete} aria-label={`Delete ${asset.name}`}><Trash2 size={14} /></button></div>;
}

function downloadText(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
