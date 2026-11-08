"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clapperboard, Clock3, FileVideo2, Film, FolderOpen, Image, LoaderCircle, Plus, Sparkles, Trash2, Upload, WandSparkles, X } from "lucide-react";
import AppShell from "@/components/AppShell";

type Project = { id: string; name: string; topic: string; format: string; duration: number; status: string; updated_at: string; asset_count: number };
type DashboardData = { projects: Project[]; stats: { projects: number; completed: number; processing: number; assets: number } };
type Tab = "editor" | "seo" | "thumbnail";

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({ projects: [], stats: { projects: 0, completed: 0, processing: 0, assets: 0 } });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [targetTab, setTargetTab] = useState<Tab>("editor");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/projects", { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Could not load projects.");
      setData(await response.json());
    } catch (error) { setToast(error instanceof Error ? error.message : "Could not load projects."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(timer);
  }, [toast]);
  function openCreate(tab: Tab = "editor") {
    setName(""); setTopic(""); setTargetTab(tab); setModal(true);
  }

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, topic }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create project.");
      if (typeof result.id !== "string" || !result.id) throw new Error("The server created no project ID. Refresh and try again.");
      setModal(false);
      router.push(`/projects/${result.id}?tab=${targetTab}`);
    } catch (error) {
      setToast(error instanceof DOMException && error.name === "TimeoutError"
        ? "Creating the project took too long. Check that the local server is running, then try again."
        : error instanceof Error ? error.message : "Could not create project.");
      setSaving(false);
    }
  }

  async function deleteProject(project: Project) {
    if (!window.confirm(`Delete "${project.name}" and its uploaded files? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Delete failed.");
      await load();
    } catch (error) { setToast(error instanceof Error ? error.message : "Delete failed."); }
  }

  return <AppShell>
    <div className="content">
      <div className="header-row">
        <div><div className="eyebrow">YOUR CREATIVE WORKSPACE</div><h1>Good to see you</h1><p className="subtitle">Turn your ideas and content into videos, right from your own computer.</p></div>
        <button className="btn btn-primary" onClick={() => openCreate()}><Plus size={16} /> New project</button>
      </div>

      <div className="stats">
        <Stat icon={<FolderOpen size={15} />} label="Total projects" value={data.stats.projects} note="Saved on this device" />
        <Stat icon={<FileVideo2 size={15} />} label="Completed videos" value={data.stats.completed} note="Ready to download" />
        <Stat icon={<LoaderCircle size={15} />} label="Processing" value={data.stats.processing} note="Currently rendering" />
        <Stat icon={<Upload size={15} />} label="Uploaded files" value={data.stats.assets} note="Stored locally" />
      </div>

      <div className="section-head" id="create"><div><h2>Start creating</h2><p>Choose a workflow to get started</p></div></div>
      <div className="quick-grid">
        <Quick icon={<Sparkles size={17} />} title="Create a video" caption="Start from a topic or script" onClick={() => openCreate("editor")} />
        <Quick icon={<Upload size={17} />} title="Upload media" caption="Add files to a new project" onClick={() => openCreate("editor")} />
        <Quick icon={<Image size={17} />} title="Make a thumbnail" caption="Design a downloadable cover" onClick={() => openCreate("thumbnail")} />
        <Quick icon={<WandSparkles size={17} />} title="Generate SEO" caption="Titles, tags and captions" onClick={() => openCreate("seo")} />
      </div>

      <div className="section-head" id="projects"><div><h2>Recent projects</h2><p>Your latest work, saved locally</p></div><span className="subtitle" style={{ fontSize: 12 }}>{data.projects.length} projects</span></div>
      {loading ? <div className="card empty"><LoaderCircle size={18} className="animate-spin" /> Loading projects…</div> : data.projects.length ? <div className="project-grid">
        {data.projects.slice(0, 6).map((project) => <article key={project.id} className="card project-card">
          <Link href={`/projects/${project.id}`} className="project-art" aria-label={`Open ${project.name}`}><Film size={34} /></Link>
          <div className="project-meta"><div className="project-name">{project.name}</div><div className="project-details"><span>{project.format} · {project.duration}s · {project.asset_count} files</span><span>{new Date(project.updated_at).toLocaleDateString()}</span></div></div>
          <div className="project-footer"><span className={`pill ${project.status === "draft" ? "pill-draft" : ""}`}><span>●</span>{project.status}</span><div style={{ display: "flex", gap: 4 }}><Link href={`/projects/${project.id}`} className="icon-button" aria-label="Open project"><ArrowRight size={15} /></Link><button className="icon-button btn-danger" aria-label={`Delete ${project.name}`} onClick={() => void deleteProject(project)}><Trash2 size={15} /></button></div></div>
        </article>)}
      </div> : <div className="card empty"><div className="empty-icon"><Clapperboard size={19} /></div><div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>Your next video starts here</div><div>Create a project to upload media, plan scenes and prepare your video.</div><button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => openCreate()}><Plus size={15} /> Create your first project</button></div>}
      <div className="section-head"><div><h2>Local-first, by design</h2><p>Your files and projects stay on this computer.</p></div></div>
      <div className="card" style={{ padding: 16, color: "var(--muted)", fontSize: 12, lineHeight: 1.65 }}>By default, scripts and SEO use offline templates. Configure Ollama for local AI text, OpenAI for optional cloud text, or SearXNG for web search. FFmpeg is required for video export. Text-to-video model generation is not included; exports use uploaded visuals.</div>
    </div>
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><form className="modal" onSubmit={(event) => void createProject(event)}><div className="modal-head"><h2>Create a project</h2><button type="button" className="icon-button" onClick={() => setModal(false)} aria-label="Close"><X size={17} /></button></div><p className="subtitle" style={{ fontSize: 12 }}>Start with a topic, website URL or your own script. Website content is not fetched automatically. {targetTab === "seo" ? "The SEO tools will open after creation." : targetTab === "thumbnail" ? "The thumbnail studio will open after creation." : ""}</p><div className="field"><label htmlFor="project-name">Project name</label><input id="project-name" className="input" placeholder="e.g. Weekend travel guide" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} autoFocus /></div><div className="field"><label htmlFor="project-topic">Topic or website URL <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label><input id="project-topic" className="input" placeholder="What is your video about?" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={2000} /></div><div className="modal-actions"><button type="button" className="btn" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} Create project</button></div></form></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </AppShell>;
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: number; note: string }) {
  return <div className="stat-card"><div className="stat-label">{icon}{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>;
}
function Quick({ icon, title, caption, onClick }: { icon: React.ReactNode; title: string; caption: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}><span className="quick-icon">{icon}</span><span><strong>{title}</strong><span>{caption}</span></span><Clock3 size={13} style={{ marginLeft: "auto", color: "var(--muted)" }} /></button>;
}
