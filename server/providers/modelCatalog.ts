import type { AiModelInfo } from '../../src/types/ai.ts'

const NON_TEXT_ONLY_PATTERNS: RegExp[] = [
  /(^|[/:_-])(text-)?embedding/i,
  /(^|[/:_-])embed(ding)?(-|$)/i,
  /(^|[/:_-])(nomic|mxbai|snowflake-arctic)-embed/i,
  /(^|[/:_-])(bge|e5)-(small|base|large|m3)/i,
  /(^|[/:_-])all-minilm/i,
  /(^|[/:_-])rerank/i,
  /(^|[/:_-])(dall-e|gpt-image|imagen|veo|flux|sdxl|stable-diffusion)/i,
  /(^|[/:_-])(whisper|tts-|gpt-4o-mini-tts|gpt-4o-transcribe|gpt-4o-mini-transcribe)/i,
  /(^|[/:_-])(omni-moderation|text-moderation)/i,
]

/**
 * Filters out unambiguously non-text-generation models (embeddings, image/video generators,
 * speech/STT/TTS, and moderation endpoints) without over-filtering valid chat/reasoning models.
 */
export function isIncompatibleNonTextModel(
  modelId: string,
  extra?: { outputModalities?: string[]; modality?: string },
): boolean {
  const normalized = modelId.trim()
  if (!normalized) return true

  if (
    extra?.outputModalities &&
    extra.outputModalities.length > 0 &&
    !extra.outputModalities.some((m) => m.toLowerCase() === 'text')
  ) {
    return true
  }

  if (extra?.modality) {
    const arrowParts = extra.modality.toLowerCase().split('->')
    if (arrowParts.length === 2 && !arrowParts[1].includes('text')) {
      return true
    }
  }

  return NON_TEXT_ONLY_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * Deduplicates discovered models by exact ID while preserving discovery order and richer metadata.
 */
export function deduplicateModels(models: AiModelInfo[]): AiModelInfo[] {
  const byName = new Map<string, AiModelInfo>()

  for (const model of models) {
    const cleanName = model.name.trim()
    if (!cleanName) continue

    const normalized: AiModelInfo = {
      ...model,
      name: cleanName,
      displayName: model.displayName?.trim() || cleanName,
    }

    const existing = byName.get(cleanName)
    if (!existing) {
      byName.set(cleanName, normalized)
      continue
    }

    // Prefer verified_text and richer metadata if duplicate appears across pages
    byName.set(cleanName, {
      ...existing,
      ...normalized,
      verificationStatus:
        existing.verificationStatus === 'verified_text' ||
        normalized.verificationStatus === 'verified_text'
          ? 'verified_text'
          : (normalized.verificationStatus ?? existing.verificationStatus),
      contextWindow: normalized.contextWindow ?? existing.contextWindow,
      sizeBytes: normalized.sizeBytes ?? existing.sizeBytes,
      parameterSize: normalized.parameterSize ?? existing.parameterSize,
      quantization: normalized.quantization ?? existing.quantization,
    })
  }

  return Array.from(byName.values())
}
