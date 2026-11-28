import { execFile } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type {
  TranscriptionEnvironmentStatus,
  WhisperModelOptionMeta,
  WhisperModelSize,
} from '../../src/types/transcription.ts'

const execFileAsync = promisify(execFile)

export type CommandProbeFn = (
  file: string,
  args: string[],
  timeoutMs?: number,
) => Promise<{ stdout: string; stderr: string; exitCode: number }>

const MODEL_CATALOG: Array<Omit<WhisperModelOptionMeta, 'downloaded'>> = [
  {
    id: 'tiny',
    label: 'Tiny (Fastest)',
    approxSizeLabel: '~75 MB',
    ramNote: 'Best for quick tests & low RAM (~1 GB)',
  },
  {
    id: 'base',
    label: 'Base (Balanced Starter)',
    approxSizeLabel: '~145 MB',
    ramNote: 'Good speed/accuracy tradeoff (~1 GB RAM)',
  },
  {
    id: 'small',
    label: 'Small (Higher Accuracy)',
    approxSizeLabel: '~465 MB',
    ramNote: 'Better for Urdu/Hinglish/noisy clips (~2 GB RAM)',
  },
  {
    id: 'medium',
    label: 'Medium (Heavy / Slow on CPU)',
    approxSizeLabel: '~1.5 GB',
    ramNote: 'High accuracy, slow on CPU (~5 GB RAM)',
  },
]

const defaultProbe: CommandProbeFn = async (file, args, timeoutMs = 6000) => {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      timeout: timeoutMs,
      windowsHide: true,
    })
    return {
      stdout: String(stdout ?? ''),
      stderr: String(stderr ?? ''),
      exitCode: 0,
    }
  } catch (err) {
    const e = err as {
      stdout?: string | Buffer
      stderr?: string | Buffer
      code?: number | string
    }
    return {
      stdout: String(e.stdout ?? ''),
      stderr: String(e.stderr ?? ''),
      exitCode: typeof e.code === 'number' ? e.code : 1,
    }
  }
}

export function resolveFfmpegCommand(): string {
  return process.env.ASTROCUT_FFMPEG_PATH?.trim() || 'ffmpeg'
}

export function resolveWhisperCacheDir(): string {
  const override = process.env.ASTROCUT_WHISPER_CACHE_DIR?.trim()
  if (override) return resolve(override)
  return resolve(process.cwd(), '.astrocut', 'models', 'whisper')
}

export function isModelCachedLocally(
  modelId: WhisperModelSize,
  cacheDir: string = resolveWhisperCacheDir(),
): boolean {
  const dirsToCheck = [
    cacheDir,
    join(homedir(), '.cache', 'whisper'),
    join(homedir(), '.cache', 'huggingface', 'hub'),
  ]

  for (const dir of dirsToCheck) {
    if (!existsSync(dir)) continue
    try {
      const entries = readdirSync(dir)
      if (
        entries.some((name) => {
          const lower = name.toLowerCase()
          return (
            lower === `${modelId}.pt` ||
            lower.includes(`faster-whisper-${modelId}`) ||
            lower.includes(`whisper-${modelId}`)
          )
        })
      ) {
        return true
      }
    } catch {
      // Ignore unreadable cache dirs
    }
  }

  return false
}

export async function resolvePythonInvocation(
  probe: CommandProbeFn = defaultProbe,
): Promise<{ command: string; prefixArgs: string[] } | null> {
  const explicit = process.env.ASTROCUT_PYTHON_BIN?.trim()
  const candidates: Array<{ command: string; prefixArgs: string[] }> = explicit
    ? [{ command: explicit, prefixArgs: [] }]
    : [
        { command: 'py', prefixArgs: ['-3'] },
        { command: 'python', prefixArgs: [] },
        { command: 'python3', prefixArgs: [] },
      ]

  for (const candidate of candidates) {
    const res = await probe(
      candidate.command,
      [...candidate.prefixArgs, '--version'],
      4000,
    )
    if (res.exitCode === 0 && /python\s+3\.\d+/i.test(`${res.stdout} ${res.stderr}`)) {
      return candidate
    }
  }
  return null
}

interface PythonWhisperProbeJson {
  engine?: 'faster-whisper' | 'openai-whisper' | 'none'
  gpuCompatible?: boolean
  gpuDetail?: string
  error?: string
}

export async function inspectTranscriptionEnvironment(
  probe: CommandProbeFn = defaultProbe,
): Promise<TranscriptionEnvironmentStatus> {
  const cacheDir = resolveWhisperCacheDir()
  const ffmpegCmd = resolveFfmpegCommand()

  const ffmpegRes = await probe(ffmpegCmd, ['-version'], 4000)
  const ffmpegAvailable = ffmpegRes.exitCode === 0
  const ffmpegFirstLine = ffmpegRes.stdout.split(/\r?\n/)[0]?.trim()

  const nvidiaRes = await probe(
    'nvidia-smi',
    ['--query-gpu=name,compute_cap', '--format=csv,noheader'],
    4000,
  )
  const gpuDetectedName =
    nvidiaRes.exitCode === 0 && nvidiaRes.stdout.trim()
      ? nvidiaRes.stdout.trim().split(/\r?\n/)[0]?.trim()
      : undefined

  const pythonInfo = await resolvePythonInvocation(probe)
  let whisperEngine: TranscriptionEnvironmentStatus['whisperEngine'] = 'none'
  let whisperReady = false
  let whisperError: string | undefined
  let gpuCompatible = false
  let computeDeviceSummary = 'CPU mode (ready when local Whisper is installed)'

  if (process.env.ASTROCUT_WHISPER_CMD?.trim()) {
    whisperEngine = 'custom'
    whisperReady = true
    computeDeviceSummary =
      'Custom local transcription command configured via ASTROCUT_WHISPER_CMD.'
  } else if (!pythonInfo) {
    whisperError =
      'Python 3 was not detected. Install Python 3.10–3.13 and faster-whisper (or configure ASTROCUT_PYTHON_BIN).'
    computeDeviceSummary = gpuDetectedName
      ? `GPU detected (${gpuDetectedName}), using safe CPU fallback until CUDA runtime compatibility is verified.`
      : 'CPU mode (Python + Whisper required).'
  } else {
    const probeScript = [
      'import json',
      'out = {"engine": "none", "gpuCompatible": False, "gpuDetail": ""}',
      'try:',
      '  import faster_whisper',
      '  out["engine"] = "faster-whisper"',
      'except Exception as fw_err:',
      '  try:',
      '    import whisper',
      '    out["engine"] = "openai-whisper"',
      '  except Exception as ow_err:',
      '    out["error"] = f"faster-whisper not installed ({fw_err}); openai-whisper not installed ({ow_err})"',
      'if out["engine"] != "none":',
      '  try:',
      '    import ctranslate2',
      '    cnt = ctranslate2.get_cuda_device_count() if hasattr(ctranslate2, "get_cuda_device_count") else 0',
      '    out["gpuDetail"] = f"ctranslate2 cuda_devices={cnt}"',
      '  except Exception:',
      '    pass',
      '  try:',
      '    import torch',
      '    if torch.cuda.is_available():',
      '      major, minor = torch.cuda.get_device_capability(0)',
      '      if major >= 7:',
      '        t = torch.zeros(1, device="cuda")',
      '        del t',
      '        out["gpuCompatible"] = True',
      '        out["gpuDetail"] = f"CUDA verified (SM {major}.{minor})"',
      '      else:',
      '        out["gpuDetail"] = f"Older GPU compute capability {major}.{minor} (< 7.0) — using CPU fallback"',
      '  except Exception as cuda_err:',
      '    out["gpuDetail"] = f"CUDA unavailable ({cuda_err}) — using CPU fallback"',
      'print(json.dumps(out))',
    ].join('\n')

    const pyProbe = await probe(
      pythonInfo.command,
      [...pythonInfo.prefixArgs, '-c', probeScript],
      8000,
    )

    if (pyProbe.exitCode !== 0) {
      whisperError =
        pyProbe.stderr.trim() ||
        'Unable to inspect Python Whisper environment.'
    } else {
      try {
        const parsed = JSON.parse(pyProbe.stdout.trim()) as PythonWhisperProbeJson
        if (parsed.engine && parsed.engine !== 'none') {
          whisperEngine = parsed.engine
          whisperReady = true
          gpuCompatible = Boolean(parsed.gpuCompatible)
          if (gpuCompatible) {
            computeDeviceSummary = `CUDA GPU verified (${parsed.gpuDetail || gpuDetectedName || 'compatible device'})`
          } else if (gpuDetectedName) {
            computeDeviceSummary = `CPU mode (${gpuDetectedName} not verified for CUDA acceleration: ${parsed.gpuDetail || 'safe CPU fallback active'})`
          } else {
            computeDeviceSummary = 'CPU mode (no compatible CUDA GPU verified)'
          }
        } else {
          whisperError =
            parsed.error ||
            'Neither faster-whisper nor openai-whisper is installed in Python.'
        }
      } catch {
        whisperError = 'Failed to parse Python Whisper diagnostic output.'
      }
    }
  }

  return {
    ffmpegAvailable,
    ffmpegVersion: ffmpegFirstLine || undefined,
    ffmpegPath: ffmpegAvailable ? ffmpegCmd : undefined,
    ffmpegError: ffmpegAvailable
      ? undefined
      : 'FFmpeg was not found in PATH or ASTROCUT_FFMPEG_PATH. Install FFmpeg to extract audio from MP4, MOV, and WebM videos.',
    pythonAvailable: Boolean(pythonInfo),
    pythonCommand: pythonInfo
      ? [pythonInfo.command, ...pythonInfo.prefixArgs].join(' ')
      : undefined,
    whisperEngine,
    whisperReady,
    whisperError,
    gpuDetectedName,
    gpuCompatible,
    computeDeviceSummary,
    cacheDir,
    models: MODEL_CATALOG.map((item) => ({
      ...item,
      downloaded: isModelCachedLocally(item.id, cacheDir),
    })),
  }
}
