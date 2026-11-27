'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { RealtimeChannel } from '@/lib/realtime/bus'

interface RealtimeSyncProps {
  channels: RealtimeChannel[]
  courseId?: string
  threadId?: string
  fallbackIntervalMs?: number
}

export function RealtimeSync({
  channels,
  courseId,
  threadId,
  fallbackIntervalMs = 15000,
}: RealtimeSyncProps) {
  const router = useRouter()
  const channelsKey = channels.join(',')
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) return
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        router.refresh()
      }, 150)
    }

    // 1. Live Server-Sent Events subscription
    const params = new URLSearchParams({ channels: channelsKey })
    if (courseId) params.set('courseId', courseId)
    if (threadId) params.set('threadId', threadId)

    let eventSource: EventSource | null = null
    try {
      eventSource = new EventSource(`/api/realtime?${params.toString()}`)
      eventSource.addEventListener('update', () => {
        scheduleRefresh()
      })
    } catch {
      // Fallback polling still handles updates
    }

    // 2. Refresh immediately when returning to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh()
      }
    }
    const handleFocus = () => {
      scheduleRefresh()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    // 3. Quiet fallback polling while tab is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }, fallbackIntervalMs)

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      eventSource?.close()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [router, channelsKey, courseId, threadId, fallbackIntervalMs])

  return null
}

