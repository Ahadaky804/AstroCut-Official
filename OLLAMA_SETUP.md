# Local AI Setup Guide — Ollama (Windows)

AstroCut uses **Ollama** as its local AI engine so you can generate YouTube, Instagram, and TikTok copy at **zero ongoing cost** without uploading your videos or descriptions to external cloud APIs.

---

## 1. Install Ollama on Windows

Download the official installer from <https://ollama.com/download>, or install using Windows Package Manager:

```powershell
winget install Ollama.Ollama
```

---

## 2. Configure Browser Access (`OLLAMA_ORIGINS`)

Because AstroCut runs in your browser (typically `http://localhost:5173`), Ollama must allow requests from your local origin.

Run this in PowerShell (you only need to do this once), then **quit and restart Ollama** from the system tray:

```powershell
setx OLLAMA_ORIGINS "http://localhost:5173,http://127.0.0.1:5173"
```

*(If you run AstroCut on another local port, include that origin or use `"*"` for local development.)*

---

## 3. Start Ollama

Launch the **Ollama** desktop app from the Start Menu, or run the server manually in a terminal:

```powershell
ollama serve
```

Default API address: `http://localhost:11434`

---

## 4. Download a Compatible Model

AstroCut discovers whatever models you have installed—no single model is hardcoded.

For a Windows 10 system with **16 GB RAM** and a **4–5 GB VRAM GPU** (such as an NVIDIA Quadro P2000) or **CPU fallback**, compact 2B–4B quantized models balance speed and quality well:

```powershell
ollama pull llama3.2:3b
```

Other lightweight alternatives:

```powershell
ollama pull qwen2.5:3b
ollama pull gemma2:2b
```

- **GPU & CPU Fallback:** Ollama automatically uses GPU VRAM when a model fits, and falls back to system RAM / CPU when VRAM is limited or no compatible GPU is used.
- **Performance Note:** Generation speed depends on the chosen model size, quantization, GPU driver version, and available RAM/VRAM.

---

## 5. Connect in AstroCut

1. Open **AI Content Studio** (`/studio`) in AstroCut.
2. Under **AI Engine**, click **Test Connection** (or **Refresh Models**).
3. Select an installed model from **Installed Model**.
4. Choose a video, optionally fill in **Describe Your Video**, select Language / Platform / Tone, and click **Generate with AI**.

---

## Privacy & Scope

- Requests are sent only to your own local Ollama endpoint (`http://localhost:11434`).
- Video files (`Blob` data in IndexedDB) are **never** uploaded to Ollama or any cloud service.
- Phase 6 uses your video title, basic metadata, and optional text context; automatic video transcription belongs to a later phase.
