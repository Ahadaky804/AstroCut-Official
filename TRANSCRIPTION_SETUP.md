# AstroCut Phase 7 — Local Video Transcription Setup (Windows 10)

AstroCut Phase 7 processes videos **100% locally on your machine** using **FFmpeg** for audio extraction and **Whisper** (`faster-whisper` or `openai-whisper`) for speech-to-text. Your private videos are never uploaded to cloud servers, and Ollama is **not** required.

---

## 1. Install Required Local Dependencies on Windows 10

### A. Install FFmpeg
FFmpeg extracts a mono 16 kHz PCM `.wav` track from MP4, MOV, and WebM videos into a temporary directory and deletes temporary files when done.

Option 1 — Using Windows Package Manager (`winget`):
```powershell
winget install Gyan.FFmpeg
```

Option 2 — Manual ZIP install:
1. Download a release build from `https://www.gyan.dev/ffmpeg/builds/` (`ffmpeg-release-essentials.zip`).
2. Extract to `C:\ffmpeg`.
3. Add `C:\ffmpeg\bin` to your Windows **PATH** environment variable, or set `ASTROCUT_FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe` inside `.env.local`.

Verify FFmpeg:
```powershell
ffmpeg -version
```

---

### B. Install Python 3.10–3.13 & Whisper
Recommended engine: **`faster-whisper`** (uses CTranslate2 `int8` CPU inference, typically faster and lower memory than standard PyTorch CPU inference).

```powershell
py -3 -m pip install --upgrade pip
py -3 -m pip install faster-whisper
```

*(Alternative fallback engine if you prefer OpenAI's reference package: `py -3 -m pip install openai-whisper`.)*

If you use a virtual environment (recommended):
```powershell
py -3 -m venv C:\astrocut-whisper-venv
C:\astrocut-whisper-venv\Scripts\python.exe -m pip install faster-whisper
```
Then set this in `.env.local`:
```env
ASTROCUT_PYTHON_BIN=C:\astrocut-whisper-venv\Scripts\python.exe
```

---

## 2. Whisper Model Sizes & Hardware Notes

AstroCut **never automatically downloads large models in the background**. Models are cached locally in `.astrocut/models/whisper/` (or `ASTROCUT_WHISPER_CACHE_DIR`) only when you explicitly start a transcription.

| Model | Approx Download Size | Approx RAM Usage | Notes |
| --- | --- | --- | --- |
| `tiny` | ~75 MB | ~1 GB | Fastest CPU test option; lower accuracy for Urdu/Hinglish |
| `base` | ~145 MB | ~1 GB | Recommended default for clean English audio on CPU |
| `small` | ~465 MB | ~2 GB | Recommended for Urdu, Hindi, and noisy recordings |
| `medium` | ~1.5 GB | ~5 GB | High accuracy, **very slow on CPU** |

---

## 3. NVIDIA Quadro P2000 & GPU Acceleration Notes

- AstroCut checks runtime CUDA compatibility before attempting GPU inference and **never assumes GPU acceleration works** just because `nvidia-smi` sees a card.
- The **NVIDIA Quadro P2000** is based on the Pascal architecture (**compute capability 6.1**). Modern `torch` / `ctranslate2` wheels frequently require compute capability **>= 7.0** or separate CUDA/cuDNN DLLs (`cublas64_12.dll`, `cudnn_ops64_9.dll`).
- When CUDA compatibility is missing or fails to initialize, AstroCut's `whisper_runner.py` safely falls back to **CPU (`int8`)** and reports the fallback transparently in the Transcription UI instead of crashing.

---

## 4. Environment Variables (Optional Overrides)

Add any overrides to `d:\AstroCut\.env.local`:

```env
ASTROCUT_FFMPEG_PATH=ffmpeg
ASTROCUT_PYTHON_BIN=py
ASTROCUT_WHISPER_CACHE_DIR=.astrocut/models/whisper
```

---

## 5. Troubleshooting

### "FFmpeg was not found on this machine"
- Re-open your terminal / restart AstroCut after editing Windows `PATH`.
- Or set `ASTROCUT_FFMPEG_PATH` to the full path of `ffmpeg.exe`.

### "Python 3 was not detected" / Microsoft Store `python.exe` stub
- Disable the App Execution Alias for `python.exe` in Windows Settings → *Manage app execution aliases*, install Python from `python.org`, or set `ASTROCUT_PYTHON_BIN` directly to your working `python.exe`.

### "This video has no audio track to transcribe"
- Confirm the MP4/MOV/WebM clip contains an audio stream (screen recordings muted at capture have no spoken audio).

### Transcription was interrupted after refreshing the browser
- Refreshing during active CPU transcription preserves uploaded videos in IndexedDB and safely marks interrupted jobs as **Failed** (unless the local backend job is still running and finishes cleanly). Click **Retry** in Video Library or Video Transcription.
