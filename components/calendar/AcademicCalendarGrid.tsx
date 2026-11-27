'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Sparkles,
  CheckCircle2,
  Plus,
  CalendarDays,
  Calendar as CalendarIcon,
  X,
  Pencil,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

export interface AcademicCalendarEvent {
  id: string
  title: string
  type: string // EST, MST, SESSIONAL, LAB_EVAL, QUIZ, VIVA, ASSIGNMENT, HOLIDAY
  start: string | Date
  venue?: string | null
  syllabusTopicIds?: string[]
  weightage?: number | null
  notes?: string | null
  isApproved: boolean
  createdById?: string | null
  courseId: string
  course: { code: string; name: string }
  batchId?: string | null
  batch?: { branch: string; year: number; group: string } | null
}

interface EventTypeStyle {
  label: string
  shortLabel: string
  priority: number
  dot: string
  pill: string
  cellBg: string
  cellBorder: string
  badge: string
  dateCircle: string
}

export const EVENT_TYPE_STYLES: Record<string, EventTypeStyle> = {
  EST: {
    label: 'End-Sem Test (EST)',
    shortLabel: 'EST',
    priority: 1,
    dot: 'bg-rose-500',
    pill: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40',
    cellBg: 'bg-rose-500/12 hover:bg-rose-500/20 dark:bg-rose-500/15 dark:hover:bg-rose-500/25',
    cellBorder: 'border-rose-500/50',
    badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/35',
    dateCircle: 'bg-rose-500 text-white',
  },
  MST: {
    label: 'Mid-Sem Test (MST)',
    shortLabel: 'MST',
    priority: 2,
    dot: 'bg-amber-500',
    pill: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40',
    cellBg: 'bg-amber-500/12 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:hover:bg-amber-500/25',
    cellBorder: 'border-amber-500/50',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/35',
    dateCircle: 'bg-amber-500 text-white',
  },
  SESSIONAL: {
    label: 'Sessional',
    shortLabel: 'Sessional',
    priority: 3,
    dot: 'bg-blue-500',
    pill: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40',
    cellBg: 'bg-blue-500/12 hover:bg-blue-500/20 dark:bg-blue-500/15 dark:hover:bg-blue-500/25',
    cellBorder: 'border-blue-500/50',
    badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/35',
    dateCircle: 'bg-blue-500 text-white',
  },
  LAB_EVAL: {
    label: 'Lab Evaluation',
    shortLabel: 'Lab Eval',
    priority: 4,
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
    cellBg: 'bg-emerald-500/12 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25',
    cellBorder: 'border-emerald-500/50',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/35',
    dateCircle: 'bg-emerald-500 text-white',
  },
  QUIZ: {
    label: 'Quiz',
    shortLabel: 'Quiz',
    priority: 5,
    dot: 'bg-purple-500',
    pill: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40',
    cellBg: 'bg-purple-500/12 hover:bg-purple-500/20 dark:bg-purple-500/15 dark:hover:bg-purple-500/25',
    cellBorder: 'border-purple-500/50',
    badge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/35',
    dateCircle: 'bg-purple-500 text-white',
  },
  VIVA: {
    label: 'Viva Voce',
    shortLabel: 'Viva',
    priority: 6,
    dot: 'bg-cyan-500',
    pill: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/40',
    cellBg: 'bg-cyan-500/12 hover:bg-cyan-500/20 dark:bg-cyan-500/15 dark:hover:bg-cyan-500/25',
    cellBorder: 'border-cyan-500/50',
    badge: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/35',
    dateCircle: 'bg-cyan-500 text-white',
  },
  ASSIGNMENT: {
    label: 'Assignment',
    shortLabel: 'Assignment',
    priority: 7,
    dot: 'bg-orange-500',
    pill: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/40',
    cellBg: 'bg-orange-500/12 hover:bg-orange-500/20 dark:bg-orange-500/15 dark:hover:bg-orange-500/25',
    cellBorder: 'border-orange-500/50',
    badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/35',
    dateCircle: 'bg-orange-500 text-white',
  },
  HOLIDAY: {
    label: 'Holiday',
    shortLabel: 'Holiday',
    priority: 8,
    dot: 'bg-zinc-500',
    pill: 'bg-zinc-500/20 text-zinc-700 dark:text-zinc-300 border-zinc-500/40',
    cellBg: 'bg-zinc-500/10 hover:bg-zinc-500/15',
    cellBorder: 'border-zinc-500/40',
    badge: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
    dateCircle: 'bg-zinc-500 text-white',
  },
}

const DEFAULT_STYLE: EventTypeStyle = {
  label: 'Evaluation',
  shortLabel: 'Event',
  priority: 99,
  dot: 'bg-primary',
  pill: 'bg-primary/15 text-primary border-primary/30',
  cellBg: 'bg-primary/10 hover:bg-primary/15',
  cellBorder: 'border-primary/40',
  badge: 'bg-primary/15 text-primary border-primary/30',
  dateCircle: 'bg-primary text-primary-foreground',
}

const LEGEND_TYPES = ['EST', 'MST', 'SESSIONAL', 'LAB_EVAL', 'QUIZ'] as const
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getEventStyle(type: string): EventTypeStyle {
  return EVENT_TYPE_STYLES[type] || DEFAULT_STYLE
}

interface AcademicCalendarGridProps {
  events: AcademicCalendarEvent[]
  role: 'STUDENT' | 'CR' | 'TEACHER'
  currentUserId?: string
  assignedCourseIds?: string[]
  onApproveEvent?: (eventId: string, courseId: string) => void
  onEditEvent?: (event: AcademicCalendarEvent) => void
  onDeleteEvent?: (eventId: string) => Promise<void> | void
  onRequestAddEvent?: (prefillDate?: string) => void
}

export function AcademicCalendarGrid({
  events,
  role,
  currentUserId,
  assignedCourseIds,
  onApproveEvent,
  onEditEvent,
  onDeleteEvent,
  onRequestAddEvent,
}: AcademicCalendarGridProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function canManageEvent(ev: AcademicCalendarEvent): boolean {
    if (role === 'TEACHER') {
      const allowedTypes = ['EST', 'MST', 'SESSIONAL', 'QUIZ']
      const teachesCourse = !assignedCourseIds || assignedCourseIds.includes(ev.courseId)
      return allowedTypes.includes(ev.type) && teachesCourse
    }
    if (role === 'CR') {
      return ev.type === 'LAB_EVAL' && Boolean(currentUserId) && ev.createdById === currentUserId
    }
    return false
  }

  async function handleDelete(eventId: string) {
    if (!onDeleteEvent) return
    setDeletingId(eventId)
    try {
      await onDeleteEvent(eventId)
    } finally {
      setDeletingId(null)
    }
  }
  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => toDateKey(today), [today])

  // Start on the current month, or if no events exist in the current month, jump to the nearest event's month
  const initialDate = useMemo(() => {
    if (events.length === 0) return today
    const currentMonthHasEvents = events.some((ev) => {
      const d = new Date(ev.start)
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
    })
    if (currentMonthHasEvents) return today
    const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    const upcoming = sorted.find((ev) => new Date(ev.start).getTime() >= today.getTime())
    return new Date((upcoming || sorted[sorted.length - 1]).start)
  }, [events, today])

  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())
  const [selectedDateKey, setSelectedDateKey] = useState<string>(toDateKey(initialDate))
  const [filterType, setFilterType] = useState<string>('ALL')

  const filteredEvents = useMemo(() => {
    if (filterType === 'ALL') return events
    return events.filter((ev) => ev.type === filterType)
  }, [events, filterType])

  // Map YYYY-MM-DD -> sorted events
  const eventsByDate = useMemo(() => {
    const map = new Map<string, AcademicCalendarEvent[]>()
    for (const ev of filteredEvents) {
      const d = new Date(ev.start)
      const key = toDateKey(d)
      const list = map.get(key) || []
      list.push(ev)
      map.set(key, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const pa = getEventStyle(a.type).priority
        const pb = getEventStyle(b.type).priority
        if (pa !== pb) return pa - pb
        return new Date(a.start).getTime() - new Date(b.start).getTime()
      })
    }
    return map
  }, [filteredEvents])

  // Build 42-cell (6-week) calendar grid for viewYear / viewMonth
  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startOffset = firstOfMonth.getDay() // 0 = Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const totalCells = startOffset + daysInMonth > 35 ? 42 : 35

    const cells: Array<{ date: Date; key: string; inCurrentMonth: boolean }> = []
    for (let i = 0; i < totalCells; i++) {
      const date = new Date(viewYear, viewMonth, 1 - startOffset + i)
      cells.push({
        date,
        key: toDateKey(date),
        inCurrentMonth: date.getMonth() === viewMonth,
      })
    }
    return cells
  }, [viewYear, viewMonth])

  const monthLabel = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    })
  }, [viewYear, viewMonth])

  const selectedEvents = eventsByDate.get(selectedDateKey) || []
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDateKey.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [selectedDateKey])

  // Events in the currently viewed month (for quick summary)
  const monthEvents = useMemo(() => {
    return filteredEvents
      .filter((ev) => {
        const d = new Date(ev.start)
        return d.getFullYear() === viewYear && d.getMonth() === viewMonth
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [filteredEvents, viewYear, viewMonth])

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  function goToToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDateKey(todayKey)
  }

  function jumpToEvent(ev: AcademicCalendarEvent) {
    const d = new Date(ev.start)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    setSelectedDateKey(toDateKey(d))
  }

  // Extra types present in events that aren't in the primary 5 legend items
  const extraTypes = useMemo(() => {
    const primarySet = new Set<string>(LEGEND_TYPES)
    const found = new Set<string>()
    for (const ev of events) {
      if (!primarySet.has(ev.type)) found.add(ev.type)
    }
    return Array.from(found)
  }, [events])

  return (
    <div className="space-y-4">
      {/* ── Color Legend & Interactive Type Filters ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterType('ALL')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
              filterType === 'ALL'
                ? 'bg-foreground text-background border-foreground font-semibold shadow-2xs'
                : 'bg-secondary/60 hover:bg-secondary text-muted-foreground border-border/60'
            }`}
          >
            <span>All</span>
            <span className="text-[10px] opacity-75">({events.length})</span>
          </button>

          {[...LEGEND_TYPES, ...extraTypes].map((typeKey) => {
            const style = getEventStyle(typeKey)
            const count = events.filter((e) => e.type === typeKey).length
            const isActive = filterType === typeKey

            return (
              <button
                key={typeKey}
                onClick={() => setFilterType(isActive ? 'ALL' : typeKey)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${
                  isActive
                    ? `${style.pill} font-semibold ring-1 ring-current`
                    : 'bg-card hover:bg-secondary/60 text-foreground/80 border-border/60'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                <span>{style.shortLabel}</span>
                {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main Split Layout: Monthly Calendar Grid + Selected Day Details ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
        {/* ── Left: Monthly Calendar Grid ── */}
        <Card className="border-border/70 overflow-hidden shadow-xs">
          {/* Calendar Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-secondary/20">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <h3 className="text-base font-bold tracking-tight text-foreground">
                {monthLabel}
              </h3>
              {monthEvents.length > 0 && (
                <Badge variant="secondary" className="text-[10px] font-semibold">
                  {monthEvents.length} {monthEvents.length === 1 ? 'event' : 'events'}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="h-7 px-2.5 text-xs"
              >
                Today
              </Button>
              <div className="inline-flex items-center rounded-md border border-border/70 bg-background">
                <button
                  type="button"
                  onClick={goToPrevMonth}
                  aria-label="Previous month"
                  className="p-1.5 hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors rounded-l-md"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-border/60" />
                <button
                  type="button"
                  onClick={goToNextMonth}
                  aria-label="Next month"
                  className="p-1.5 hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors rounded-r-md"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Weekday Column Headers */}
          <div className="grid grid-cols-7 border-b border-border/50 bg-secondary/10">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((cell, idx) => {
              const dayEvents = eventsByDate.get(cell.key) || []
              const hasEvents = dayEvents.length > 0
              const primaryStyle = hasEvents ? getEventStyle(dayEvents[0].type) : null
              const isToday = cell.key === todayKey
              const isSelected = cell.key === selectedDateKey

              // Unique event types on this day (for multi-dot indicator)
              const uniqueTypes = hasEvents
                ? Array.from(new Set(dayEvents.map((e) => e.type)))
                : []

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => {
                    setSelectedDateKey(cell.key)
                    if (!cell.inCurrentMonth) {
                      setViewYear(cell.date.getFullYear())
                      setViewMonth(cell.date.getMonth())
                    }
                  }}
                  className={`relative min-h-[84px] sm:min-h-[96px] p-1.5 sm:p-2 text-left border-b border-r border-border/40 transition-all flex flex-col justify-between focus:outline-none ${
                    (idx + 1) % 7 === 0 ? 'border-r-0' : ''
                  } ${
                    !cell.inCurrentMonth
                      ? 'bg-secondary/15 text-muted-foreground/45 hover:bg-secondary/30'
                      : hasEvents && primaryStyle
                        ? `${primaryStyle.cellBg}`
                        : 'bg-card hover:bg-secondary/35'
                  } ${
                    isSelected
                      ? 'ring-2 ring-inset ring-primary z-10'
                      : hasEvents && primaryStyle && cell.inCurrentMonth
                        ? `ring-1 ring-inset ${primaryStyle.cellBorder}`
                        : ''
                  }`}
                >
                  {/* Top Row: Date Number + Event Type Dots */}
                  <div className="flex items-center justify-between w-full gap-1">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                        isToday
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : hasEvents && primaryStyle && cell.inCurrentMonth
                            ? `${primaryStyle.dateCircle} shadow-2xs`
                            : cell.inCurrentMonth
                              ? 'text-foreground'
                              : 'text-muted-foreground/50'
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>

                    {uniqueTypes.length > 0 && (
                      <div className="flex items-center gap-0.5 flex-wrap justify-end">
                        {uniqueTypes.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            title={getEventStyle(t).label}
                            className={`w-1.5 h-1.5 rounded-full ${getEventStyle(t).dot}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Event Pills inside Day Cell */}
                  {hasEvents && (
                    <div className="mt-1 space-y-0.5 w-full overflow-hidden">
                      {dayEvents.slice(0, 2).map((ev) => {
                        const st = getEventStyle(ev.type)
                        return (
                          <div
                            key={ev.id}
                            className={`text-[10px] leading-tight font-semibold px-1.5 py-0.5 rounded border truncate ${st.pill} ${
                              !ev.isApproved ? 'border-dashed opacity-80' : ''
                            }`}
                            title={`${ev.course.code} — ${ev.title} (${st.label})`}
                          >
                            <span className="hidden sm:inline">{ev.course.code} · </span>
                            {st.shortLabel}
                          </div>
                        )
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-[9px] font-bold text-muted-foreground pl-1">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* ── Right: Selected Date Panel & Month Overview ── */}
        <div className="space-y-4">
          <Card className="border-border/70 p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {selectedDateObj.toLocaleDateString('default', { weekday: 'long' })}
                </p>
                <h4 className="text-base font-bold text-foreground">
                  {selectedDateObj.toLocaleDateString('default', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h4>
              </div>

              {(role === 'CR' || role === 'TEACHER') && onRequestAddEvent && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onRequestAddEvent(`${selectedDateKey}T09:30`)}
                  className="h-7 px-2.5 text-[11px]"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              )}
            </div>

            {selectedEvents.length === 0 ? (
              <div className="py-6 text-center space-y-1.5">
                <CalendarIcon className="w-6 h-6 text-muted-foreground/50 mx-auto" />
                <p className="text-xs font-medium text-foreground">No evaluations on this date</p>
                <p className="text-[11px] text-muted-foreground">
                  Select a highlighted date on the calendar to inspect exam details.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedEvents.map((ev) => {
                  const st = getEventStyle(ev.type)
                  const d = new Date(ev.start)

                  return (
                    <div
                      key={ev.id}
                      className={`relative p-3 rounded-xl border bg-background space-y-2 ${
                        !ev.isApproved ? 'border-dashed border-amber-500/50' : st.cellBorder
                      }`}
                    >
                      {canManageEvent(ev) && (onEditEvent || onDeleteEvent) && (
                        <div className="absolute right-2 top-2 flex items-center gap-0.5">
                          {onEditEvent && (
                            <button
                              type="button"
                              onClick={() => onEditEvent(ev)}
                              disabled={deletingId === ev.id}
                              title="Edit event"
                              aria-label={`Edit ${ev.title}`}
                              className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteEvent && (
                            <button
                              type="button"
                              onClick={() => handleDelete(ev.id)}
                              disabled={deletingId === ev.id}
                              title="Remove event"
                              aria-label={`Remove ${ev.title}`}
                              className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            >
                              {deletingId === ev.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      <div className={`flex flex-wrap items-center gap-1.5 ${canManageEvent(ev) && (onEditEvent || onDeleteEvent) ? 'pr-12' : ''}`}>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {ev.course.code}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                        {!ev.isApproved && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400"
                          >
                            Pending
                          </Badge>
                        )}
                      </div>

                      <div>
                        <h5 className="font-bold text-xs text-foreground">{ev.title}</h5>
                        {ev.notes && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {ev.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-primary" />
                          {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {ev.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary" />
                            {ev.venue}
                          </span>
                        )}
                        {ev.weightage != null && (
                          <span className="font-semibold text-foreground/80">
                            {ev.weightage}% weight
                          </span>
                        )}
                        {ev.batch ? (
                          <span className="font-mono text-[10px]">
                            {ev.batch.branch}-{ev.batch.group}
                          </span>
                        ) : role === 'TEACHER' ? (
                          <span className="font-mono text-[10px]">All Batches</span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 pt-1.5 border-t border-border/40">
                        {role === 'CR' && !ev.isApproved && onApproveEvent && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => onApproveEvent(ev.id, ev.courseId)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2.5"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                        )}

                        {role === 'TEACHER' ? (
                          <Button asChild variant="outline" size="sm" className="text-[11px] h-7 px-2.5 ml-auto">
                            <Link href={`/courses/${ev.courseId}?from=calendar`}>View Course</Link>
                          </Button>
                        ) : (
                          <Button asChild variant="outline" size="sm" className="text-[11px] h-7 px-2.5 ml-auto">
                            <Link href={`/courses/${ev.courseId}/assistant?from=calendar`}>
                              <Sparkles className="w-3 h-3 mr-1 text-accent" />
                              Prepare
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* ── Quick-Jump Scheduled Events List ── */}
          {filteredEvents.length > 0 && (
            <Card className="border-border/70 p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Scheduled Dates
                </h5>
                <span className="text-[11px] text-muted-foreground">
                  {filteredEvents.length} total
                </span>
              </div>

              <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                {[...filteredEvents]
                  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                  .map((ev) => {
                    const st = getEventStyle(ev.type)
                    const d = new Date(ev.start)
                    const key = toDateKey(d)
                    const isCurrentSelected = key === selectedDateKey

                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => jumpToEvent(ev)}
                        className={`w-full text-left p-2 rounded-lg border transition-all flex items-center gap-2.5 ${
                          isCurrentSelected
                            ? `${st.cellBg} ${st.cellBorder}`
                            : 'border-border/40 hover:bg-secondary/40'
                        }`}
                      >
                        <div className={`w-2 h-8 rounded-full shrink-0 ${st.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-bold text-primary">
                              {ev.course.code} · {st.shortLabel}
                            </span>
                            <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                              {d.toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-foreground truncate">
                            {ev.title}
                          </p>
                        </div>
                      </button>
                    )
                  })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

