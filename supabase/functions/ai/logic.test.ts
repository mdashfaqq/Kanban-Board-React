import { describe, expect, it } from 'vitest'
import {
  buildMessages,
  describeBoard,
  extractJson,
  isOperation,
  normalizeCards,
  normalizeFindings,
  type BoardSnapshot,
} from './logic.ts'

const board: BoardSnapshot = {
  name: 'Launch',
  columns: [
    { name: 'Todo', wip_limit: null, cards: [{ title: 'Write copy', priority: 'high', blocked: false, estimated_time_minutes: 60 }] },
    { name: 'In Progress', wip_limit: 1, cards: [
      { title: 'Build hero', priority: null, blocked: true, estimated_time_minutes: null },
      { title: 'Pricing page', priority: 'medium', blocked: false, estimated_time_minutes: null },
    ] },
  ],
}

describe('isOperation', () => {
  it('accepts known operations only', () => {
    expect(isOperation('board_analysis')).toBe(true)
    expect(isOperation('free_tokens')).toBe(false)
    expect(isOperation(42)).toBe(false)
  })
})

describe('describeBoard', () => {
  it('includes columns, WIP limits, blocked flags and priorities', () => {
    const text = describeBoard(board)
    expect(text).toContain('In Progress (WIP limit 1) — 2 card(s)')
    expect(text).toContain('Build hero [BLOCKED]')
    expect(text).toContain('Write copy [priority=high, 60m]')
  })

  it('caps the number of cards sent to the model', () => {
    const big: BoardSnapshot = {
      name: 'Big',
      columns: [{ name: 'Todo', wip_limit: null, cards: Array.from({ length: 200 }, (_, i) => ({
        title: `Card ${i}`, priority: null, blocked: false, estimated_time_minutes: null,
      })) }],
    }
    const text = describeBoard(big)
    expect(text).toContain('Card 119')
    expect(text).not.toContain('Card 120')
    expect(text).toContain('80 more card(s) omitted')
  })
})

describe('buildMessages', () => {
  it('puts the objective in the generate_cards prompt and truncates long input', () => {
    const msgs = buildMessages('generate_cards', board, 'x'.repeat(2000))
    expect(msgs[0].role).toBe('system')
    expect(msgs[1].content).toContain('"cards"')
    expect(msgs[1].content.length).toBeLessThan(2000)
  })

  it('appends the free-text question for analysis commands', () => {
    const msgs = buildMessages('board_analysis', board, 'why is it slow?')
    expect(msgs[1].content).toContain('The user also asked: "why is it slow?"')
  })
})

describe('extractJson', () => {
  it('parses plain JSON, fenced JSON and JSON with chatter', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 })
    expect(extractJson('Sure! Here you go: {"a":3} Hope that helps.')).toEqual({ a: 3 })
  })

  it('throws when there is no JSON', () => {
    expect(() => extractJson('I cannot help with that')).toThrow()
  })
})

describe('normalizeCards', () => {
  it('validates and clamps model output', () => {
    const cards = normalizeCards({
      cards: [
        { title: 'Design', description: 'Mockups', estimated_time: 5, priority: 'urgent', suggested_labels: ['Design', 'UI', 'x', 'y'] },
        { title: '', description: 'no title' },
        { title: 'Ship', estimated_time: 'abc' },
      ],
    })
    expect(cards).toHaveLength(2)
    expect(cards[0]).toEqual({ title: 'Design', description: 'Mockups', estimated_time: 15, priority: 'medium', suggested_labels: ['design', 'ui', 'x'] })
    expect(cards[1].estimated_time).toBe(60)
  })

  it('rejects responses without usable cards', () => {
    expect(() => normalizeCards({ cards: [] })).toThrow()
    expect(() => normalizeCards({ findings: [] })).toThrow()
  })
})

describe('normalizeFindings', () => {
  it('maps title/recommendation to the UI finding shape', () => {
    const r = normalizeFindings('board_analysis', {
      findings: [{ title: 'WIP overflow', recommendation: 'Finish Build hero first.' }],
      summary: 'One bottleneck.',
    })
    expect(r).toEqual({
      operation: 'board_analysis',
      findings: [{ type: 'WIP overflow', recommendation: 'Finish Build hero first.' }],
      message: 'One bottleneck.',
    })
  })

  it('rejects empty responses', () => {
    expect(() => normalizeFindings('board_analysis', { findings: [] })).toThrow()
  })
})
