import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { buildStudioPrompts } from '../src/services/promptBuilder.ts'
import type { AiGenerationRequest } from '../src/types/ai.ts'
import {
  exportTranscriptToSrt,
  exportTranscriptToTxt,
  joinSegmentsText,
} from '../src/utils/transcriptExport.ts'
import { ServerConfigStore } from './configStore.ts'
import {
  generateWithRouting,
  transformTranscriptWithRouting,
} from './routingEngine.ts'
import {
  AudioExtractionError,
  extractAudioToWav,
} from './transcription/audioExtractor.ts'
import { inspectTranscriptionEnvironment } from './transcription/environment.ts'
import {
  DuplicateTranscriptionJobError,
  TranscriptionJobManager,
} from './transcription/jobManager.ts'
import { runLocalWhisperTranscription } from './transcription/whisperEngine.ts'

async function withMockServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const addr = server.address() as { port: number }
  try {
    await fn(`http://127.0.0.1:${addr.port}`)
  } finally {
    server.close()
  }
}

describe('Phase 7 — Video Transcription & Processing', () => {
  it('extracts audio for MP4, MOV, and WebM via FFmpeg and rejects unsupported formats and missing streams', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'astrocut-ffmpeg-test-'))
    try {
      for (const ext of ['mp4', 'mov', 'webm'] as const) {
        const videoFile = join(dir, `clip.${ext}`)
        writeFileSync(videoFile, Buffer.from(`fake-${ext}-bytes`))
        let seenArgs: string[] = []

        const out = await extractAudioToWav(videoFile, dir, `clip.${ext}`, {
          ffmpegPath: 'ffmpeg',
          runner: async (_cmd, args) => {
            seenArgs = args
            const wavTarget = args[args.length - 1]
            writeFileSync(wavTarget, Buffer.alloc(128, 1))
            return { stdout: '', stderr: '' }
          },
        })

        assert.equal(out.extension, ext)
        assert.ok(seenArgs.includes('pcm_s16le'))
        assert.ok(seenArgs.includes('16000'))
      }

      const aviFile = join(dir, 'clip.avi')
      writeFileSync(aviFile, Buffer.from('avi'))
      await assert.rejects(
        () => extractAudioToWav(aviFile, dir, 'clip.avi'),
        (err: unknown) =>
          err instanceof AudioExtractionError &&
          err.code === 'unsupported_format',
      )

      const mp4File = join(dir, 'silent.mp4')
      writeFileSync(mp4File, Buffer.from('mp4'))
      await assert.rejects(
        () =>
          extractAudioToWav(mp4File, dir, 'silent.mp4', {
            runner: async () => {
              const e = new Error('Output file does not contain any stream') as Error & {
                stderr: string
              }
              e.stderr = 'Output file does not contain any stream'
              throw e
            },
          }),
        (err: unknown) =>
          err instanceof AudioExtractionError && err.code === 'no_audio_stream',
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('transcribes English and Urdu segments cleanly with CPU fallback and stage callbacks', async () => {
    const stages: string[] = []
    const urduResult = await runLocalWhisperTranscription(
      'fake.wav',
      'small',
      'ur',
      {
        runner: async ({ callbacks }) => {
          callbacks?.onStage?.('loading_model', 'Loading small on cpu')
          callbacks?.onStage?.('transcribing', 'Running whisper...')
          return {
            languageCode: 'ur',
            detectedLanguage: 'ur',
            modelSize: 'small',
            engineName: 'faster-whisper',
            deviceUsed: 'cpu (int8)',
            fallbackNote:
              'Quadro P2000 uses compute capability 6.1 (< 7.0); using safe CPU fallback.',
            segments: [
              {
                id: 'seg-1',
                startSeconds: 0,
                endSeconds: 3.5,
                text: 'آج کی ویڈیو میں خوش آمدید',
              },
              {
                id: 'seg-2',
                startSeconds: 3.5,
                endSeconds: 7.2,
                text: 'ہم ویڈیو ایڈیٹنگ سیکھیں گے',
              },
            ],
            originalText: 'آج کی ویڈیو میں خوش آمدید\nہم ویڈیو ایڈیٹنگ سیکھیں گے',
          }
        },
        callbacks: {
          onStage: (s) => stages.push(s),
        },
      },
    )

    assert.deepEqual(stages, ['loading_model', 'transcribing'])
    assert.equal(urduResult.languageCode, 'ur')
    assert.equal(urduResult.segments.length, 2)
    assert.match(urduResult.fallbackNote || '', /Quadro P2000/i)
  })

  it('enforces safe CPU fallback for NVIDIA Quadro P2000 in environment diagnostics', async () => {
    const env = await inspectTranscriptionEnvironment(async (file, args) => {
      if (file === 'ffmpeg') {
        return { stdout: 'ffmpeg version 7.0', stderr: '', exitCode: 0 }
      }
      if (file === 'nvidia-smi') {
        return { stdout: 'Quadro P2000, 6.1\n', stderr: '', exitCode: 0 }
      }
      if (file === 'py' && args.includes('--version')) {
        return { stdout: 'Python 3.13.0', stderr: '', exitCode: 0 }
      }
      if (file === 'py' && args.includes('-c')) {
        return {
          stdout: JSON.stringify({
            engine: 'faster-whisper',
            gpuCompatible: false,
            gpuDetail: 'Older GPU compute capability 6.1 (< 7.0) — using CPU fallback',
          }),
          stderr: '',
          exitCode: 0,
        }
      }
      return { stdout: '', stderr: '', exitCode: 1 }
    })

    assert.equal(env.ffmpegAvailable, true)
    assert.equal(env.whisperReady, true)
    assert.equal(env.gpuCompatible, false)
    assert.match(env.computeDeviceSummary, /Quadro P2000/i)
    assert.match(env.computeDeviceSummary, /CPU/i)
  })

  it('prevents duplicate concurrent jobs, supports retry after failure, cleans temp files, and cancels on video deletion', async () => {
    let shouldFail = true
    const dir1 = mkdtempSync(join(tmpdir(), 'astrocut-job1-'))
    const vid1 = join(dir1, 'source.mp4')
    writeFileSync(vid1, Buffer.from('mp4'))

    let releaseTranscribe!: () => void
    const manager = new TranscriptionJobManager({
      extractAudio: async (_v, outDir) => {
        const wav = join(outDir, 'extracted-audio.wav')
        writeFileSync(wav, Buffer.alloc(64, 1))
        return { wavPath: wav }
      },
      transcribeAudio: async (_wav, modelSize, language, callbacks) => {
        callbacks.onStage('transcribing', 'Transcribing clip...')
        await new Promise<void>((r) => {
          releaseTranscribe = r
        })
        if (shouldFail) {
          throw new Error('Simulated Whisper failure')
        }
        return {
          languageCode: language === 'auto' ? 'en' : language,
          detectedLanguage: 'en',
          modelSize,
          engineName: 'faster-whisper',
          deviceUsed: 'cpu (int8)',
          segments: [
            { id: 'seg-1', startSeconds: 0, endSeconds: 2.5, text: 'Hello AstroCut' },
          ],
          originalText: 'Hello AstroCut',
        }
      },
    })

    const firstJob = manager.enqueue({
      videoId: 'vid-1',
      fileName: 'clip.mp4',
      fileExtension: 'mp4',
      modelSize: 'base',
      language: 'en',
      tempDir: dir1,
      tempVideoPath: vid1,
    })

    // Wait a tick until transcribeAudio is active
    await new Promise((r) => setTimeout(r, 20))

    const dupDir = mkdtempSync(join(tmpdir(), 'astrocut-dup-'))
    const dupVid = join(dupDir, 'source.mp4')
    writeFileSync(dupVid, Buffer.from('mp4'))
    assert.throws(
      () =>
        manager.enqueue({
          videoId: 'vid-1',
          fileName: 'clip.mp4',
          fileExtension: 'mp4',
          modelSize: 'base',
          language: 'en',
          tempDir: dupDir,
          tempVideoPath: dupVid,
        }),
      (err: unknown) => err instanceof DuplicateTranscriptionJobError,
    )
    assert.equal(existsSync(dupDir), false)

    // Finish first job with failure -> cleans dir1
    releaseTranscribe()
    await new Promise((r) => setTimeout(r, 30))
    const failedSnap = manager.getJob(firstJob.jobId)!
    assert.equal(failedSnap.status, 'failed')
    assert.equal(existsSync(dir1), false)

    // Retry succeeds after failure
    shouldFail = false
    const dir2 = mkdtempSync(join(tmpdir(), 'astrocut-job2-'))
    const vid2 = join(dir2, 'source.mp4')
    writeFileSync(vid2, Buffer.from('mp4'))
    const retryJob = manager.enqueue({
      videoId: 'vid-1',
      fileName: 'clip.mp4',
      fileExtension: 'mp4',
      modelSize: 'tiny',
      language: 'en',
      tempDir: dir2,
      tempVideoPath: vid2,
    })
    await new Promise((r) => setTimeout(r, 20))
    releaseTranscribe()
    await new Promise((r) => setTimeout(r, 30))

    const okSnap = manager.getJob(retryJob.jobId)!
    assert.equal(okSnap.status, 'completed')
    assert.equal(okSnap.result?.originalText, 'Hello AstroCut')
    assert.equal(existsSync(dir2), false)

    // Video deletion cleanup removes stored jobs for that videoId
    const removed = manager.deleteVideoJobs('vid-1')
    assert.equal(removed, 2)
    assert.equal(manager.listJobs().length, 0)
  })

  it('edits segments while preserving timestamps and exports valid TXT and SRT files', () => {
    const edited = [
      { id: 'seg-1', startSeconds: 1.25, endSeconds: 4.5, text: 'First edited line' },
      { id: 'seg-2', startSeconds: 65.5, endSeconds: 70.0, text: 'Second edited line' },
    ]

    assert.equal(joinSegmentsText(edited), 'First edited line\nSecond edited line')
    const txt = exportTranscriptToTxt(edited, { includeTimestamps: true })
    assert.match(txt, /\[00:01 -> 00:04\] First edited line/)
    assert.match(txt, /\[01:05 -> 01:10\] Second edited line/)

    const srt = exportTranscriptToSrt(edited)
    assert.match(srt, /^1\n00:00:01,250 --> 00:00:04,500\nFirst edited line\n\n2\n00:01:05,500 --> 00:01:10,000\nSecond edited line\n$/)
  })

  it('runs standalone Roman Urdu transliteration & English translation and grounds AI Studio prompts in real transcript text without claiming video vision', async () => {
    await withMockServer(
      (req, res) => {
        let body = ''
        req.on('data', (c) => {
          body += c.toString()
        })
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json')
          if (req.url === '/v1/chat/completions') {
            const parsed = JSON.parse(body) as {
              messages: Array<{ role: string; content: string }>
            }
            const userMsg = parsed.messages.find((m) => m.role === 'user')?.content || ''
            if (/Roman Urdu/i.test(userMsg)) {
              res.end(
                JSON.stringify({
                  model: 'gpt-4o-mini',
                  choices: [
                    { message: { content: 'Aaj ki video mein khush amdeed' } },
                  ],
                }),
              )
              return
            }
            if (/into English/i.test(userMsg)) {
              res.end(
                JSON.stringify({
                  model: 'gpt-4o-mini',
                  choices: [
                    { message: { content: 'Welcome to today’s video' } },
                  ],
                }),
              )
              return
            }
            res.end(
              JSON.stringify({
                model: 'gpt-4o-mini',
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        youtube: {
                          title: 'Color Grading Tutorial Summary',
                          description: 'Generated directly from the saved transcript.',
                          keywords: 'color grading, editing',
                          hashtags: '#Editing #AstroCut',
                        },
                      }),
                    },
                  },
                ],
              }),
            )
            return
          }
          res.statusCode = 404
          res.end()
        })
      },
      async (baseUrl) => {
        const dir = mkdtempSync(join(tmpdir(), 'astrocut-tx-ai-'))
        try {
          const store = new ServerConfigStore(dir)
          store.upsertProvider({
            id: 'openai',
            baseUrl: `${baseUrl}/v1`,
            apiKey: 'sk-test-tx',
            defaultModel: 'gpt-4o-mini',
          })
          store.updateRouting({
            mode: 'manual',
            defaultProviderId: 'openai',
            defaultModel: 'gpt-4o-mini',
          })

          const roman = await transformTranscriptWithRouting(store, {
            mode: 'roman_urdu',
            transcriptText: 'آج کی ویڈیو میں خوش آمدید',
            sourceLanguage: 'ur',
          })
          assert.equal(roman.text, 'Aaj ki video mein khush amdeed')

          const english = await transformTranscriptWithRouting(store, {
            mode: 'english_translation',
            transcriptText: 'آج کی ویڈیو میں خوش آمدید',
            sourceLanguage: 'ur',
          })
          assert.equal(english.text, 'Welcome to today’s video')

          const req: AiGenerationRequest = {
            videoId: 'vid-1',
            videoTitle: 'Editing Intro',
            transcriptText: 'In this clip we adjust shadows and highlights carefully.',
            transcriptLanguage: 'en',
            settings: {
              language: 'english',
              platformSelection: 'youtube',
              tone: 'educational',
            },
            platforms: ['youtube'],
            taskType: 'video_summaries',
          }

          const prompts = buildStudioPrompts(req)
          assert.match(prompts.systemPrompt, /NOT watched visual frames/i)
          assert.match(
            prompts.userPrompt,
            /adjust shadows and highlights carefully/,
          )

          const summary = await generateWithRouting(store, req)
          assert.equal(summary.content.youtube?.title, 'Color Grading Tutorial Summary')
        } finally {
          rmSync(dir, { recursive: true, force: true })
        }
      },
    )
  })
})
