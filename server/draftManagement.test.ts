import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  type UpgradeableDatabase,
  upgradeAstroCutDatabase,
} from '../src/services/indexedDbSchema.ts'
import type { ContentDraftRecord } from '../src/types/draft.ts'
import {
  computeDashboardDraftMetrics,
  filterAndSortDrafts,
} from '../src/utils/draftFilters.ts'

function makeSampleDraft(
  overrides: Partial<ContentDraftRecord> = {},
): ContentDraftRecord {
  return {
    id: 'draft-1',
    videoId: 'vid-1',
    name: 'Morning Vlog Draft',
    platformSelection: 'multiple',
    platforms: ['youtube', 'instagram', 'tiktok'],
    language: 'english',
    tone: 'engaging',
    content: {
      youtube: {
        title: 'How I Edit Color Fast',
        description: 'Quick grading breakdown',
        keywords: 'color grading, video',
        hashtags: '#Editing',
      },
      instagram: {
        caption: 'Color tips in 60 seconds',
        hashtags: '#Reels',
      },
      tiktok: {
        caption: 'Night LUT trick',
        hashtags: '#TokTips',
      },
    },
    subtitlesText: '1\n00:00:00,000 --> 00:00:03,000\nHello world\n',
    transcriptLanguage: 'en',
    status: 'draft',
    createdAt: '2026-11-28T10:00:00.000Z',
    updatedAt: '2026-11-28T10:00:00.000Z',
    ...overrides,
  }
}

describe('Phase 8 — Draft Management', () => {
  it('performs additive IndexedDB schema migration without touching existing v2 stores', () => {
    const existingStores = new Set(['videos', 'videoBlobs', 'transcripts'])
    const createdStores: string[] = []
    const createdIndexes: Array<{ store: string; name: string }> = []

    const fakeDb: UpgradeableDatabase = {
      objectStoreNames: {
        contains: (name: string) => existingStores.has(name),
      },
      createObjectStore: (name: string) => {
        existingStores.add(name)
        createdStores.push(name)
        return {
          createIndex: (idxName: string) => {
            createdIndexes.push({ store: name, name: idxName })
          },
        }
      },
    }

    upgradeAstroCutDatabase(fakeDb)

    assert.deepEqual(createdStores, ['drafts'])
    assert.deepEqual(createdIndexes, [
      { store: 'drafts', name: 'videoId' },
      { store: 'drafts', name: 'updatedAt' },
    ])
    assert.equal(existingStores.has('videos'), true)
    assert.equal(existingStores.has('videoBlobs'), true)
    assert.equal(existingStores.has('transcripts'), true)
  })

  it('filters and sorts drafts by name/title, platform, status, and timestamps', () => {
    const d1 = makeSampleDraft({
      id: 'd1',
      videoId: 'v1',
      name: 'Alpha Tutorial',
      platformSelection: 'youtube',
      platforms: ['youtube'],
      status: 'draft',
      createdAt: '2026-11-28T08:00:00.000Z',
      updatedAt: '2026-11-28T09:00:00.000Z',
    })
    const d2 = makeSampleDraft({
      id: 'd2',
      videoId: 'v2',
      name: 'Beta Reels Launch',
      platformSelection: 'instagram',
      platforms: ['instagram'],
      status: 'ready_for_review',
      createdAt: '2026-11-28T10:00:00.000Z',
      updatedAt: '2026-11-28T12:00:00.000Z',
    })
    const d3 = makeSampleDraft({
      id: 'd3',
      videoId: 'v1',
      name: 'Multi Campaign',
      platformSelection: 'multiple',
      platforms: ['youtube', 'instagram', 'tiktok'],
      status: 'approved',
      createdAt: '2026-11-28T11:00:00.000Z',
      updatedAt: '2026-11-28T11:30:00.000Z',
    })

    const videoTitles = { v1: 'Editing Guide', v2: 'Behind the Scenes' }

    const byStatus = filterAndSortDrafts([d1, d2, d3], {
      searchQuery: '',
      platformFilter: 'all',
      statusFilter: 'ready_for_review',
      sortBy: 'updated-desc',
      videoTitlesById: videoTitles,
    })
    assert.deepEqual(
      byStatus.map((d) => d.id),
      ['d2'],
    )

    const byPlatform = filterAndSortDrafts([d1, d2, d3], {
      searchQuery: '',
      platformFilter: 'youtube',
      statusFilter: 'all',
      sortBy: 'updated-desc',
      videoTitlesById: videoTitles,
    })
    assert.deepEqual(
      byPlatform.map((d) => d.id),
      ['d3', 'd1'],
    )

    const byVideoSearch = filterAndSortDrafts([d1, d2, d3], {
      searchQuery: 'behind the scenes',
      platformFilter: 'all',
      statusFilter: 'all',
      sortBy: 'oldest',
      videoTitlesById: videoTitles,
    })
    assert.deepEqual(
      byVideoSearch.map((d) => d.id),
      ['d2'],
    )

    const sortedAlpha = filterAndSortDrafts([d1, d2, d3], {
      searchQuery: '',
      platformFilter: 'all',
      statusFilter: 'all',
      sortBy: 'name-asc',
    })
    assert.deepEqual(
      sortedAlpha.map((d) => d.id),
      ['d1', 'd2', 'd3'],
    )
  })

  it('computes real Dashboard metrics from drafts without hardcoded values', () => {
    const metrics = computeDashboardDraftMetrics([
      makeSampleDraft({
        id: '1',
        status: 'draft',
        updatedAt: '2026-11-28T08:00:00.000Z',
      }),
      makeSampleDraft({
        id: '2',
        status: 'ready_for_review',
        updatedAt: '2026-11-28T10:00:00.000Z',
      }),
      makeSampleDraft({
        id: '3',
        status: 'ready_for_review',
        updatedAt: '2026-11-28T12:00:00.000Z',
      }),
      makeSampleDraft({
        id: '4',
        status: 'approved',
        updatedAt: '2026-11-28T11:00:00.000Z',
      }),
    ])

    assert.equal(metrics.totalDrafts, 4)
    assert.equal(metrics.awaitingReview, 2)
    assert.equal(metrics.approvedDrafts, 1)
    assert.deepEqual(
      metrics.recentDrafts.map((d) => d.id),
      ['3', '4', '2', '1'],
    )
  })
})
