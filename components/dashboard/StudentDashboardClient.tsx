'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  CalendarDays,
  Sparkles,
  BarChart3,
  HelpCircle,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  Layers,
  ChevronRight,
  Calendar,
  X,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createCalendarEvent, approveCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/app/courses/[id]/calendar/actions'

import { EnrollButton } from '@/components/course/EnrollButton'
import { AcademicCalendarGrid, AcademicCalendarEvent } from '@/components/calendar/AcademicCalendarGrid'
import { RealtimeSync } from '@/components/realtime/RealtimeSync'

interface EnrolledCourse {
  id: string
  code: string
  name: string
  semester: number
  dept: string
}

interface UniversalCalendarEvent {
  id: string
  title: string
  type: string // MST, EST, QUIZ, SESSIONAL, LAB_EVAL, VIVA, ASSIGNMENT, HOLIDAY
  start: string | Date
  venue?: string | null
  syllabusTopicIds: string[]
  weightage?: number | null
  notes?: string | null
  isApproved: boolean
  createdById?: string | null
  courseId: string
  course: { code: string; name: string }
  batchId?: string | null
  batch?: { branch: string; year: number; group: string } | null
}

interface StudentDashboardClientProps {
  userId: string
  userName: string
  userEmail: string
  userRole: 'STUDENT' | 'CR'
  userBatch?: { branch: string; year: number; group: string } | null
  userBatchId?: string | null
  enrolledCourses: EnrolledCourse[]
  allCatalogCourses: EnrolledCourse[]
  allEvents: UniversalCalendarEvent[]
  initialTab?: 'courses' | 'calendar' | 'catalog'
}

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string; border: string }> = {
  MST: { label: 'Mid-Sem Test (MST)', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  EST: { label: 'End-Sem Test (EST)', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', border: 'border-rose-500/30' },
  QUIZ: { label: 'Surprise / Online Quiz', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
  SESSIONAL: { label: 'Sessional Evaluation', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  LAB_EVAL: { label: 'Lab Evaluation', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  VIVA: { label: 'Viva Voce', color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400', border: 'border-cyan-500/30' },
  ASSIGNMENT: { label: 'Assignment Deadline', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', border: 'border-orange-500/30' },
  HOLIDAY: { label: 'Academic Holiday', color: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400', border: 'border-zinc-500/30' },
}

export function StudentDashboardClient({
  userId,
  userName,
  userEmail,
  userRole,
  userBatch,
  userBatchId,
  enrolledCourses,
  allCatalogCourses,
  allEvents: initialEvents,
  initialTab = 'courses',
}: StudentDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'courses' | 'calendar' | 'catalog'>(initialTab)
  const [events, setEvents] = useState<UniversalCalendarEvent[]>(initialEvents)
  const [filterType, setFilterType] = useState<string>('ALL')

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])

  // CR Scheduling / Edit Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState(enrolledCourses[0]?.id || '')
  const [eventTitle, setEventTitle] = useState('')
  const [eventType, setEventType] = useState('LAB_EVAL')
  const [eventDate, setEventDate] = useState('')
  const [eventVenue, setEventVenue] = useState('')
  const [eventWeightage, setEventWeightage] = useState('30')
  const [eventNotes, setEventNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const isCR = userRole === 'CR'

  // Filter events
  const filteredEvents = events.filter((ev) => {
    if (filterType === 'ALL') return true
    if (filterType === 'EXAMS') return ['MST', 'EST', 'SESSIONAL'].includes(ev.type)
    if (filterType === 'LABS') return ['LAB_EVAL', 'QUIZ', 'VIVA'].includes(ev.type)
    return ev.type === filterType
  })

  function formatDateTimeLocal(dateVal: string | Date): string {
    const d = new Date(dateVal)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function openCreateModal(prefillDate?: string) {
    setEditingEventId(null)
    setSelectedCourseId(enrolledCourses[0]?.id || '')
    setEventTitle('')
    setEventType('LAB_EVAL')
    setEventDate(prefillDate || '')
    setEventVenue('')
    setEventWeightage('30')
    setEventNotes('')
    setModalError(null)
    setShowAddModal(true)
  }

  function openEditModal(ev: AcademicCalendarEvent) {
    setEditingEventId(ev.id)
    setSelectedCourseId(ev.courseId)
    setEventTitle(ev.title)
    setEventType(ev.type)
    setEventDate(formatDateTimeLocal(ev.start))
    setEventVenue(ev.venue || '')
    setEventWeightage(ev.weightage != null ? String(ev.weightage) : '')
    setEventNotes(ev.notes || '')
    setModalError(null)
    setShowAddModal(true)
  }

  // Handle schedule / edit event
  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setModalError(null)

    try {
      if (!selectedCourseId) throw new Error('Please select a course.')
      if (!eventTitle.trim()) throw new Error('Please enter an event title.')
      if (!eventDate) throw new Error('Please select event date and time.')

      const matchedCourse = enrolledCourses.find((c) => c.id === selectedCourseId)
      const parsedWeightage = eventWeightage ? parseFloat(eventWeightage) : undefined

      if (editingEventId) {
        await updateCalendarEvent(editingEventId, {
          courseId: selectedCourseId,
          title: eventTitle.trim(),
          type: eventType as any,
          start: new Date(eventDate).toISOString(),
          venue: eventVenue.trim() || undefined,
          weightage: parsedWeightage ?? null,
          notes: eventNotes.trim() || undefined,
        })

        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === editingEventId
              ? {
                  ...ev,
                  courseId: selectedCourseId,
                  course: { code: matchedCourse?.code || ev.course.code, name: matchedCourse?.name || ev.course.name },
                  title: eventTitle.trim(),
                  type: eventType,
                  start: new Date(eventDate).toISOString(),
                  venue: eventVenue.trim() || null,
                  weightage: parsedWeightage ?? null,
                  notes: eventNotes.trim() || null,
                }
              : ev
          )
        )
      } else {
        const result = await createCalendarEvent({
          courseId: selectedCourseId,
          batchId: userBatchId || null,
          title: eventTitle.trim(),
          type: eventType as any,
          start: new Date(eventDate).toISOString(),
          venue: eventVenue.trim() || undefined,
          syllabusTopicIds: [],
          weightage: parsedWeightage,
          notes: eventNotes.trim() || undefined,
        })

        const newEv: UniversalCalendarEvent = {
          id: result.eventId,
          title: eventTitle.trim(),
          type: eventType,
          start: new Date(eventDate).toISOString(),
          venue: eventVenue.trim() || null,
          syllabusTopicIds: [],
          weightage: parsedWeightage ?? null,
          notes: eventNotes.trim() || null,
          isApproved: isCR, // CR publishes directly; student creates pending suggestion
          createdById: userId,
          courseId: selectedCourseId,
          course: { code: matchedCourse?.code || 'COURSE', name: matchedCourse?.name || '' },
          batchId: userBatchId || null,
          batch: userBatch || null,
        }

        setEvents((prev) => [newEv, ...prev])
      }

      setShowAddModal(false)
      setEditingEventId(null)
      setEventTitle('')
      setEventDate('')
      setEventVenue('')
      setEventNotes('')
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApprove(evId: string, courseId: string) {
    try {
      await approveCalendarEvent(evId, courseId)
      setEvents((prev) =>
        prev.map((e) => (e.id === evId ? { ...e, isApproved: true } : e))
      )
    } catch (err) {
      console.error('Failed to approve event:', err)
    }
  }

  async function handleDeleteEvent(evId: string) {
    try {
      await deleteCalendarEvent(evId)
      setEvents((prev) => prev.filter((e) => e.id !== evId))
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }

  return (
    <div className="space-y-6">
      <RealtimeSync channels={['calendar']} />

      {/* ── Segmented Control Bar ── */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="inline-flex p-1 rounded-xl bg-secondary/60 border border-border/50 text-xs font-medium">
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'courses'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>My Courses ({enrolledCourses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'calendar'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Academic Calendar</span>
            {events.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {events.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'catalog'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Course Catalog ({allCatalogCourses.length})</span>
          </button>
        </div>

        {activeTab === 'calendar' && isCR && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => openCreateModal()}
              className="brand-gradient text-white text-xs h-8 font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Event
            </Button>
          </div>
        )}
      </div>

      {/* ── TAB 1: Enrolled Courses ── */}
      {activeTab === 'courses' && (
        <div className="space-y-6 animate-fade-in">
          {enrolledCourses.length === 0 ? (
            <Card className="border-dashed p-10 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto" />
              <h3 className="text-base font-semibold">No courses enrolled yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Enroll in your semester subjects to access Question Banks, topic weightages, and the AI tutor.
              </p>
              <Button asChild size="sm" className="mt-2 text-xs">
                <Link href="/courses">Browse Catalog</Link>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {enrolledCourses.map((c) => (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}?from=courses`}
                  className="p-4 rounded-xl border border-border/60 bg-card hover:border-primary/50 hover:bg-secondary/30 transition-all flex items-center justify-between group"
                >
                  <div className="space-y-1 min-w-0 pr-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {c.code}
                    </span>
                    <h3 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {c.name}
                    </h3>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Singular Universal Academic Calendar ── */}
      {activeTab === 'calendar' && (
        <div className="animate-fade-in">
          <AcademicCalendarGrid
            events={events}
            role={userRole}
            currentUserId={userId}
            onApproveEvent={handleApprove}
            onEditEvent={isCR ? openEditModal : undefined}
            onDeleteEvent={isCR ? handleDeleteEvent : undefined}
            onRequestAddEvent={
              isCR
                ? (prefillDate) => openCreateModal(prefillDate)
                : undefined
            }
          />
        </div>
      )}

      {/* ── TAB 3: Course Catalog ── */}
      {activeTab === 'catalog' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allCatalogCourses.map((c) => {
              const isEnrolled = enrolledCourses.some((ec) => ec.id === c.id)

              return (
                <div
                  key={c.id}
                  className={`p-4 rounded-xl border bg-card transition-all flex flex-col justify-between gap-3 ${
                    isEnrolled ? 'border-primary/40 bg-primary/[0.02]' : 'border-border/60 hover:border-border'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {c.code}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        Sem {c.semester}
                      </Badge>
                    </div>

                    <h3 className="font-semibold text-sm text-foreground truncate">
                      {c.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.dept}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <EnrollButton courseId={c.id} initialEnrolled={isEnrolled} />
                    <Button asChild variant="ghost" size="sm" className="h-7 text-xs px-2 text-primary hover:text-primary/80">
                      <Link href={`/courses/${c.id}?from=catalog`} className="inline-flex items-center gap-1">
                        Open
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Schedule / Suggest Event Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md border-border/80 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-5 border-b border-border/50">
              <h3 className="font-bold text-base text-foreground">
                {editingEventId ? 'Edit Event' : 'Add Event'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editingEventId
                  ? 'Changes will update immediately on the academic calendar for your sub-group.'
                  : 'Event will be published immediately to the singular academic calendar for your sub-group.'}
              </p>
            </div>

            <CardContent className="p-5">
              {modalError && (
                <div className="mb-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleAddEvent} className="space-y-3.5 text-xs">
                {/* Subject Selector */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Subject</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs"
                    required
                  >
                    {enrolledCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Event Title */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Title / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Lab Evaluation 1 — OS Process Scheduling"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    required
                    className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs"
                  />
                </div>

                {/* Type & Weightage */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Evaluation Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs"
                    >
                      <option value="LAB_EVAL">Lab Evaluation</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Marks Weightage (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={eventWeightage}
                      onChange={(e) => setEventWeightage(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs"
                    />
                  </div>
                </div>

                {/* Date & Venue */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      required
                      className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Venue</label>
                    <input
                      type="text"
                      placeholder="e.g. LP-108 / Lab 3"
                      value={eventVenue}
                      onChange={(e) => setEventVenue(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    size="sm"
                    className="brand-gradient text-white h-8 text-xs px-4"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : editingEventId ? (
                      'Save Changes'
                    ) : (
                      'Publish to Batch Calendar'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

