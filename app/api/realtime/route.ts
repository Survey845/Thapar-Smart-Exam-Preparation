import { subscribeRealtimeEvents, RealtimeChannel } from '@/lib/realtime/bus'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const channelsParam = searchParams.get('channels') || 'calendar,forum'
  const allowedChannels = new Set(
    channelsParam
      .split(',')
      .map((c) => c.trim())
      .filter((c): c is RealtimeChannel => c === 'calendar' || c === 'forum')
  )
  const courseId = searchParams.get('courseId') || undefined
  const threadId = searchParams.get('threadId') || undefined

  const encoder = new TextEncoder()
  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      let closed = false

      const safeEnqueue = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }

      // Confirm stream established
      safeEnqueue(': connected\n\n')

      const unsubscribe = subscribeRealtimeEvents((payload) => {
        if (!allowedChannels.has(payload.channel)) return
        if (courseId && payload.courseId && payload.courseId !== courseId) return
        if (threadId && payload.threadId && payload.threadId !== threadId) return

        safeEnqueue(`event: update\ndata: ${JSON.stringify(payload)}\n\n`)
      })

      const heartbeat = setInterval(() => {
        safeEnqueue(': ping\n\n')
      }, 25000)

      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Stream already closed
        }
      }

      req.signal.addEventListener('abort', () => {
        cleanup?.()
      })
    },
    cancel() {
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

