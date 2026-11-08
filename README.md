# AI Video Creator

A local-first video workspace built with Next.js, TypeScript, SQLite, and FFmpeg. Projects, uploaded files, and exports are stored in the `data/` folder on your computer. It can use Ollama for local AI text generation, an optional cloud text-AI provider, and an optional SearXNG search instance.

## What works

- Create, reopen, rename, save, and delete projects. Project metadata is stored in SQLite at `data/creator.sqlite`.
- Make a variation by duplicating a project, its settings, script and uploaded assets; then edit the copy independently.
- Upload and remove JPG, PNG, WEBP, MP4, MOV, AVI, MP3, WAV, PDF, DOC/DOCX, TXT, and PPT/PPTX files. Uploads are stored in `data/uploads/`, limited to 100 MB per file and 250 MB per batch, and show browser upload progress.
- Choose vertical (9:16), landscape (16:9), or square (1:1) output, and a duration from 15 seconds to 5 minutes or a custom duration up to 10 minutes.
- Draft a script with a local Ollama model, optional OpenAI API, or an **offline writing template**. The mode is configured explicitly; templates are not presented as an AI model.
- Prepare offline SEO suggestions, download them as text, and export script scenes as an SRT caption file.
- Read a public GitHub repository's README, manifest and a small source-file sample to draft an intro/launch script. This is read-only: repository code is never executed or tested. GitHub's unauthenticated API rate limit applies.
- Search the web via a SearXNG instance that you configure. Search phrases are sent to that instance; results are not fetched automatically beyond the search response.
- Create and download a simple, editable SVG thumbnail template. Background removal and AI image generation are not included.
- Render a video from one uploaded image or video, applying the chosen aspect ratio and duration. An uploaded audio file can be included as the soundtrack. Rendering uses FFmpeg and exports an MP4 under `data/exports/`.
- Optional Ollama/OpenAI script and SEO generation is available when configured. API calls are made only by server routes; cloud API keys are not sent to the browser.
- Dark and light themes, responsive layout, local storage notices, progress, and visible error messages.

## Not included / limitations

- Uploaded PDF, Word, and PowerPoint documents are stored and managed but their contents are **not** extracted. Website URLs are saved as a topic/brief only; the app does not fetch website pages.
- The renderer currently uses one visual asset, not a multi-scene timeline/editor. It does not synthesize voice, create images, or remove image backgrounds.
- **Text-to-video generation is not included.** FFmpeg assembles an uploaded image/video and optional audio; it does not generate video from text. Ollama makes text (scripts/SEO), not videos. A separate compatible local video model/runtime and substantial GPU resources are needed for actual generated visuals.
- Offline script and SEO output are templates, not machine learning. No AI or search calls are made unless the related provider is configured.
- The thumbnail export is SVG. An image editor may be used to convert it to PNG/JPG.
- Local storage size is limited by the free space on the computer; uploads are not encrypted and there is no user login. Keep the server bound to localhost unless you understand the LAN-access implications.

## Requirements

- Windows 10/11, macOS, or Linux
- Node.js 20.9 or later and npm
- FFmpeg for video rendering. The dashboard, project storage, uploads, script/SEO templates, captions, and SVG thumbnail work without FFmpeg.

## Install and run (Windows)

1. Install Node.js LTS from [nodejs.org](https://nodejs.org/). Open a new PowerShell terminal after installation.
2. Install FFmpeg. One option with `winget` is:

   ```powershell
   winget install Gyan.FFmpeg.Shared
   ```

   Alternatively, download an FFmpeg build from [ffmpeg.org](https://ffmpeg.org/download.html), extract it, and add its `bin` folder to your Windows `PATH`. Restart PowerShell and verify with `ffmpeg -version`.
3. Open PowerShell in this project folder and install dependencies:

   ```powershell
   npm.cmd install
   ```

   If npm 11 reports that the `better-sqlite3` install script was withheld, approve and rebuild it:

   ```powershell
   npm.cmd install-scripts approve better-sqlite3
   npm.cmd rebuild better-sqlite3
   ```

4. Optional: copy `.env.example` to `.env.local` and configure local AI, internet search, or an OpenAI key. Keep `.env.local` private. `AI_PROVIDER=template` works without AI dependencies.
5. Start the development server:

   ```powershell
   npm.cmd run dev
   ```

6. Visit [http://localhost:3000](http://localhost:3000).

For a production build, run `npm.cmd run build`, then `npm.cmd start`.

### Optional free local AI with Ollama

1. Install Ollama from [ollama.com](https://ollama.com/download).
2. In a separate PowerShell window, download a small text model:

   ```powershell
   ollama pull qwen2.5:3b
   ```

3. In `.env.local`, configure:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
```

Restart the app after editing `.env.local`. Ollama runs the selected **text** model locally; first model download requires internet. Model speed and RAM/GPU use depend on the machine. If Ollama is unavailable, the UI shows an error rather than silently switching modes.

### Optional cloud text AI

Alternatively, set `AI_PROVIDER=openai` and configure `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env.local`. Requests go from the server to OpenAI; internet access and an account are required and usage may cost money. Never put the key in frontend code or commit `.env.local`. To use templates, set `AI_PROVIDER=template`.

### Optional web search with SearXNG

Run or choose a SearXNG instance you trust, enable its JSON search format, and set its base URL in `.env.local`:

```env
SEARXNG_URL=http://127.0.0.1:8080
```

The app sends search queries to that instance. Search needs internet access on the SearXNG host. No SearXNG server is bundled with this project.

### Local network and IP settings

By default, the app listens only on this computer (`127.0.0.1:3000`). Configure a different bind address/port in `.env.local`, then restart the app:

```env
AVC_HOST=127.0.0.1
AVC_PORT=3000
```

To share on a **trusted home/office LAN**, set `AVC_HOST=0.0.0.0` and `AVC_PORT=3000`. Find your PC's LAN IPv4 address with `ipconfig`, then open `http://YOUR-LAN-IP:3000` from another device on that LAN. Windows Firewall may ask to allow Node.js; allow access only on a trusted Private network. This application currently has no login or encryption: anyone who can reach that port can access project APIs and local files. Do not expose it to the public internet or forward the port from your router. Return `AVC_HOST` to `127.0.0.1` for local-only use.

## FFmpeg options

FFmpeg must be available on `PATH`. If it is installed elsewhere, put its executable path in `.env.local`:

```env
FFMPEG_PATH=C:\tools\ffmpeg\bin\ffmpeg.exe
```

Rendering uses H.264 (`libx264`) and AAC audio when an audio track is supplied (or source video audio is present). Rendering time and supported formats depend on your FFmpeg build, source files, CPU, and available disk space. The application does not bundle FFmpeg.

## Project structure

```text
app/
  api/                    Next.js API routes for projects, files, scripts, SEO and export
  api/projects/[id]/repository/  Read-only public GitHub repository analysis
  api/projects/[id]/search/      Optional SearXNG search
  projects/[id]/           Video editor workspace
  globals.css              Responsive dark/light UI styles
components/
  AppShell.tsx             Sidebar, navigation and theme control
lib/
  ai.ts                    Ollama/OpenAI server-side text provider
  content.ts               Offline script, SEO and launch-script templates
  db.ts                    SQLite connection and local storage paths
scripts/
  run-next.mjs             Cross-platform host/port configuration
data/                      Created at runtime: SQLite DB, uploads and exports
.env.example               Optional server-side settings
```

## Troubleshooting

- **`npm` is blocked in PowerShell:** if your machine blocks the `npm.ps1` shim, use `npm.cmd install` and `npm.cmd run dev`, or use Command Prompt.
- **Database module install fails:** use an up-to-date supported Node.js LTS and retry `npm install`. `better-sqlite3` includes a native addon and may need a compatible prebuilt binary or Windows C++ build tools.
- **FFmpeg not found:** verify `ffmpeg -version` in the same terminal used to start the server, or set `FFMPEG_PATH` in `.env.local`, then restart the app.
- **Render reports no visual:** upload at least one supported image or video to the project. Text, audio, and documents alone cannot be rendered into visuals.
- **Upload rejected:** check that the extension is supported, the browser provides a recognized file type, and the file is 100 MB or smaller.
- **OpenAI errors:** verify the API key, model name, internet connection, and account limits. The local offline templates remain available after removing the key.
- **Ollama errors:** make sure Ollama is running, `ollama list` shows the configured model, and `OLLAMA_BASE_URL` points to localhost.
- **GitHub repository errors:** only public `github.com/owner/repository` URLs are supported. GitHub unauthenticated API rate limits may require waiting before retrying.
- **Search errors:** check `SEARXNG_URL`, confirm the server is reachable, and enable JSON output in the SearXNG instance.
- **Create project appears stuck:** wait for the timeout message, confirm the terminal running `npm.cmd run dev` has no API/database error, then reload the browser and retry. The project ID is created before the editor navigation; check the dashboard's recent projects before submitting again to avoid duplicates.
- **“Another next dev server is already running”:** return to the PowerShell window that started the earlier app and press `Ctrl+C` once. Wait for it to stop, then run `npm.cmd run dev` again. Do not start multiple development servers in the same project folder.
- **Other devices cannot connect:** confirm `AVC_HOST=0.0.0.0`, use the computer's LAN IP (not `localhost`) from the other device, and permit access only on a trusted Private Windows Firewall profile.
- **Reset local data:** stop the server, then back up and remove only the project’s `data` folder. This permanently deletes saved projects, uploads, and exports.
