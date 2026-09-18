import type {
  ChatEvent,
  EnvelopeKind,
  EnvelopeSegment,
  Message,
  Segment,
  ToolSegment,
} from '@/lib/types'

/** A segment as a live chat holds it: the stored shapes plus two local-only
 *  tails — a pending envelope whose JSON has not resolved yet (the engine
 *  streams no envelope content, so the skeleton is all the client has), and
 *  a tool card still running. */
export type StreamSegment =
  | Segment
  | { type: 'pending'; kind: EnvelopeKind; repairing: boolean }
  | { type: 'tool-running'; id: string; tool: ToolSegment['kind']; args?: unknown }

/** Folds one chat event into the streamed segment list. Pure: returns a new
 *  list, safe to use inside a state updater. Both chats speak the same
 *  events, so both fold with this. */
export function applyChatEvent(segments: StreamSegment[], ev: ChatEvent): StreamSegment[] {
  switch (ev.type) {
    case 'tool-start':
      return [...segments, { type: 'tool-running', id: ev.id, tool: ev.tool, args: ev.args }]
    case 'tool-result': {
      const seg: ToolSegment = {
        type: 'tool',
        kind: ev.tool,
        payload: {
          id: ev.id,
          tool: ev.tool,
          args: ev.args,
          result: ev.summary,
          ok: ev.ok,
          pages: ev.pages,
        },
      }
      // The running card is usually the tail, but a tool that emitted a
      // question event first can leave something after it.
      const at = segments.findIndex((s) => s.type === 'tool-running' && s.id === ev.id)
      if (at === -1) return [...segments, seg]
      return [...segments.slice(0, at), seg, ...segments.slice(at + 1)]
    }
    case 'delta': {
      if (ev.text === '') return segments
      const last = segments[segments.length - 1]
      if (last?.type === 'prose') {
        return [...segments.slice(0, -1), { type: 'prose', text: last.text + ev.text }]
      }
      return [...segments, { type: 'prose', text: ev.text }]
    }
    case 'envelope-start':
      return [...segments, { type: 'pending', kind: ev.kind, repairing: false }]
    case 'envelope-repairing': {
      const last = segments[segments.length - 1]
      if (last?.type === 'pending' && last.kind === ev.kind) {
        return [...segments.slice(0, -1), { ...last, repairing: true }]
      }
      return segments
    }
    case 'envelope': {
      const seg = { type: 'envelope', kind: ev.kind, payload: ev.payload } as EnvelopeSegment
      const last = segments[segments.length - 1]
      if (last?.type === 'pending') {
        return [...segments.slice(0, -1), seg]
      }
      return [...segments, seg]
    }
    case 'envelope-failed': {
      const seg: Segment = { type: 'code', text: ev.raw }
      const last = segments[segments.length - 1]
      if (last?.type === 'pending') {
        return [...segments.slice(0, -1), seg]
      }
      return [...segments, seg]
    }
    default:
      return segments
  }
}

/** @deprecated use applyChatEvent. */
export const applyAskEvent = applyChatEvent

/** Markdown form of an answer for the copy button: prose, envelopes re-fenced
 *  with their JSON, degraded payloads fenced plain. Tool cards are the
 *  model's working, not its answer, so they are left out. */
export function segmentsToText(segments: StreamSegment[]): string {
  let out = ''
  for (const seg of segments) {
    switch (seg.type) {
      case 'prose':
        out += seg.text
        break
      case 'envelope':
        out += '```' + seg.kind + '\n' + JSON.stringify(seg.payload) + '\n```\n'
        break
      case 'code':
        out += '```\n' + seg.text + '\n```\n'
        break
      case 'pending':
      case 'tool':
      case 'tool-running':
        break
    }
  }
  return out.replace(/\n+$/, '\n')
}

/** The pages an answer consulted, in the order they were first reached:
 *  what retrieval gave it, then whatever its tools went and read. This
 *  replaces parsing page numbers back out of prose — the model writes
 *  (p. 143) as prose and the strip is fed by what actually happened. */
export function consultedPages(retrieved: number[], segments: StreamSegment[]): number[] {
  const out: number[] = []
  const add = (n: number) => {
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n)
  }
  retrieved.forEach(add)
  for (const seg of segments) {
    if (seg.type === 'tool') (seg.payload.pages ?? []).forEach(add)
  }
  return out
}

/** The consulted strip of a stored message. Legacy threads kept extracted
 *  citations and have no tool cards; they still render from those. */
export function messagePages(message: Message): number[] {
  return consultedPages(message.citations ?? [], message.segments)
}
