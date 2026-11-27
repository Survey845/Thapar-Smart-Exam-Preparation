import { EventEmitter } from 'events'

export type RealtimeChannel = 'calendar' | 'forum'

export interface RealtimeEventPayload {
  channel: RealtimeChannel
  courseId?: string
  threadId?: string
  timestamp: number
}

const globalForRealtime = globalThis as unknown as {
  __tietRealtimeBus?: EventEmitter
}

function getBus(): EventEmitter {
  if (!globalForRealtime.__tietRealtimeBus) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(200)
    globalForRealtime.__tietRealtimeBus = emitter
  }
  return globalForRealtime.__tietRealtimeBus
}

export function publishRealtimeEvent(
  channel: RealtimeChannel,
  meta?: { courseId?: string; threadId?: string }
) {
  const payload: RealtimeEventPayload = {
    channel,
    courseId: meta?.courseId,
    threadId: meta?.threadId,
    timestamp: Date.now(),
  }
  getBus().emit('realtime:update', payload)
}

export function subscribeRealtimeEvents(
  listener: (payload: RealtimeEventPayload) => void
): () => void {
  const bus = getBus()
  bus.on('realtime:update', listener)
  return () => {
    bus.off('realtime:update', listener)
  }
}

