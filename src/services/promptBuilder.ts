import type {
  InstagramContent,
  StudioDraftContent,
  StudioLanguage,
  StudioPlatform,
  TikTokContent,
  YouTubeContent,
} from '../types/studio'
import { formatDuration, formatFileSize } from '../utils/videoFormat'
import type { AiGenerationRequest } from './aiProvider'

const LANGUAGE_INSTRUCTIONS: Record<StudioLanguage, string> = {
  english:
    'Write all generated text in natural, fluent English.',
  'roman-urdu':
    'Write all generated text in Roman Urdu using Latin letters only (e.g. "Aaj ki video mein"). Never use Urdu/Arabic script.',
  hinglish:
    'Write all generated text in natural Hinglish (conversational Hindi/Urdu mixed with English) using Latin letters only. Never use Devanagari or Urdu script.',
}

function buildPlatformSchemaSnippet(platforms: StudioPlatform[]): string {
  const parts: string[] = []
  if (platforms.includes('youtube')) {
    parts.push(
      `"youtube": { "title": "string (max 100 chars)", "description": "string", "keywords": "comma-separated keywords string", "hashtags": "space-separated #hashtags string" }`,
    )
  }
  if (platforms.includes('instagram')) {
    parts.push(
      `"instagram": { "caption": "string", "hashtags": "space-separated #hashtags string" }`,
    )
  }
  if (platforms.includes('tiktok')) {
    parts.push(
      `"tiktok": { "caption": "string", "hashtags": "space-separated #hashtags string" }`,
    )
  }
  return `{\n  ${parts.join(',\n  ')}\n}`
}

/**
 * Builds system and user prompts strictly grounded in supplied metadata and user video context.
 */
export function buildStudioPrompts(request: AiGenerationRequest): {
  systemPrompt: string
  userPrompt: string
} {
  const durationLabel = formatDuration(request.durationSeconds)
  const sizeLabel =
    request.sizeBytes !== undefined ? formatFileSize(request.sizeBytes) : undefined

  const systemPrompt = [
    'You are an assistant inside AstroCut, a video content workspace.',
    LANGUAGE_INSTRUCTIONS[request.settings.language],
    `Match this tone: ${request.settings.tone}.`,
    'Important grounding rules:',
    '- You have NOT watched or transcribed the video. Only use the supplied title, metadata, and user description.',
    '- Do NOT invent scenes, quotes, benchmarks, people, or facts not supported by the provided context.',
    '- Avoid keyword stuffing and irrelevant hashtags.',
    '- Output ONLY valid JSON matching the requested platform keys, with no markdown prose outside JSON.',
  ].join('\n')

  const contextLines = [
    `Video Title: ${request.videoTitle}`,
    request.fileExtension
      ? `Format: ${request.fileExtension.toUpperCase()}`
      : null,
    durationLabel ? `Duration: ${durationLabel}` : null,
    sizeLabel ? `File Size: ${sizeLabel}` : null,
    request.videoContext?.trim()
      ? `User Video Description / Context: ${request.videoContext.trim()}`
      : 'User Video Description / Context: None provided (rely conservatively on the video title only; do not fabricate details).',
  ].filter(Boolean)

  const userPrompt = [
    ...contextLines,
    '',
    `Target Language: ${request.settings.language}`,
    `Target Tone: ${request.settings.tone}`,
    `Target Platforms: ${request.platforms.join(', ')}`,
    '',
    'Return ONLY a JSON object with this exact structure:',
    buildPlatformSchemaSnippet(request.platforms),
  ].join('\n')

  return { systemPrompt, userPrompt }
}

function asCleanString(value: unknown, joinSeparator = ' '): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .join(joinSeparator)
  }
  return ''
}

function extractJsonObject(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim()
  if (!trimmed) {
    throw new Error('The AI model returned an empty response.')
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    const startIdx = candidate.indexOf('{')
    const endIdx = candidate.lastIndexOf('}')
    if (startIdx !== -1 && endIdx > startIdx) {
      try {
        parsed = JSON.parse(candidate.slice(startIdx, endIdx + 1))
      } catch (err) {
        throw new Error(
          'The AI model returned invalid JSON output. Try generating again or selecting a different model.',
          { cause: err },
        )
      }
    } else {
      throw new Error(
        'The AI model response did not contain valid JSON. Try generating again or selecting another model.',
      )
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The AI model returned an unexpected JSON structure.')
  }

  return parsed as Record<string, unknown>
}

/**
 * Parses and validates Ollama JSON text output into AstroCut platform draft sections.
 */
export function parseGeneratedStudioResponse(
  rawText: string,
  requestedPlatforms: StudioPlatform[],
): {
  content: Partial<StudioDraftContent>
  warnings: string[]
} {
  const root = extractJsonObject(rawText)
  const content: Partial<StudioDraftContent> = {}
  const warnings: string[] = []
  let hasAnyNonEmptyField = false

  if (requestedPlatforms.includes('youtube')) {
    const section = root.youtube
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      const obj = section as Record<string, unknown>
      const yt: YouTubeContent = {
        title: asCleanString(obj.title),
        description: asCleanString(obj.description, '\n'),
        keywords: asCleanString(obj.keywords, ', '),
        hashtags: asCleanString(obj.hashtags, ' '),
      }
      if (yt.title || yt.description || yt.keywords || yt.hashtags) {
        hasAnyNonEmptyField = true
        content.youtube = yt
      } else {
        warnings.push('YouTube section returned empty fields.')
      }
    } else {
      warnings.push('YouTube section was omitted by the model.')
    }
  }

  if (requestedPlatforms.includes('instagram')) {
    const section = root.instagram
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      const obj = section as Record<string, unknown>
      const ig: InstagramContent = {
        caption: asCleanString(obj.caption, '\n'),
        hashtags: asCleanString(obj.hashtags, ' '),
      }
      if (ig.caption || ig.hashtags) {
        hasAnyNonEmptyField = true
        content.instagram = ig
      } else {
        warnings.push('Instagram section returned empty fields.')
      }
    } else {
      warnings.push('Instagram section was omitted by the model.')
    }
  }

  if (requestedPlatforms.includes('tiktok')) {
    const section = root.tiktok
    if (section && typeof section === 'object' && !Array.isArray(section)) {
      const obj = section as Record<string, unknown>
      const tt: TikTokContent = {
        caption: asCleanString(obj.caption, '\n'),
        hashtags: asCleanString(obj.hashtags, ' '),
      }
      if (tt.caption || tt.hashtags) {
        hasAnyNonEmptyField = true
        content.tiktok = tt
      } else {
        warnings.push('TikTok section returned empty fields.')
      }
    } else {
      warnings.push('TikTok section was omitted by the model.')
    }
  }

  if (!hasAnyNonEmptyField) {
    throw new Error(
      'The AI model returned empty content for all selected platforms. Try adding more video context or switching models.',
    )
  }

  return { content, warnings }
}
