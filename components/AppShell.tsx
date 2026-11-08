"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clapperboard, Film, FolderOpen, Gauge, Image, LayoutDashboard, Moon, Sun } from "lucide-react";

export default function AppShell({ children, section = "Dashboard", projectId }: { children: React.ReactNode; section?: string; projectId?: string }) {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const preference = localStorage.getItem("avc-theme") === "light";
    setLight(preference);
    document.body.classList.toggle("light", preference);
  }, []);
  function toggleTheme() {
    const next = !light;
    setLight(next);
    document.body.classList.toggle("light", next);
    localStorage.setItem("avc-theme", next ? "light" : "dark");
  }
  const projectPath = projectId ? `/projects/${projectId}` : "";
  const links = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "My Projects", href: "/#projects", icon: FolderOpen },
    { label: "Video Editor", href: projectId ? `${projectPath}?tab=editor` : "/#create", icon: Film },
    { label: "SEO Studio", href: projectId ? `${projectPath}?tab=seo` : "/#projects", icon: Gauge },
    { label: "Thumbnail Studio", href: projectId ? `${projectPath}?tab=thumbnail` : "/#projects", icon: Image },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="AI Video Creator home">
          <span className="brand-icon"><Clapperboard size={19} /></span><span className="brand-name">AI Video Creator</span>
        </Link>
        <div className="nav-label">Workspace</div>
        <nav>{links.map(({ label, href, icon: Icon }) => <Link key={label} href={href} className={`nav-item ${section === label ? "active" : ""}`} title={label}><Icon size={17} /><span>{label}</span></Link>)}</nav>
        <div className="side-bottom">
          <div className="nav-label">Local workspace</div>
          <div className="usage"><div className="usage-line"><span>Storage</span><span>Local disk</span></div><div className="usage-track"><div className="usage-fill" /></div></div>
          <button className="nav-item" onClick={toggleTheme} title={`Switch to ${light ? "dark" : "light"} theme`}><Sun size={17} /><span>Switch theme</span></button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar"><div className="crumb">Workspace <span style={{ margin: "0 8px", color: "#555" }}>/</span><span style={{ color: "var(--text)" }}>{section}</span></div><div className="top-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">{light ? <Moon size={17} /> : <Sun size={17} />}</button><div className="avatar">AV</div></div></header>
        {children}
      </main>
    </div>
  );
}
