'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  MessageSquare,
  FileCheck2,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  Search,
  Check,
  AlertCircle,
  X,
  Loader2,
  CalendarDays,
  Calendar,
  Plus,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QuestionReviewCard } from '@/components/admin/QuestionReviewCard'
import { ApproveAllButton } from '@/components/admin/ApproveAllButton'
import { AppointCRCard } from '@/components/admin/AppointCRCard'
import { assignUserRoleAction } from '@/app/admin/actions'
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/app/courses/[id]/calendar/actions'
import { AcademicCalendarGrid, AcademicCalendarEvent } from '@/components/calendar/AcademicCalendarGrid'
import { RealtimeSync } from '@/components/realtime/RealtimeSync'

interface QuestionItem {
  id: string
  questionNumber: string | null
  text: string
  marks: number
  type: string
  difficulty: string
  topicTags: string[]
  confidence: number | null
  course: { code: string; name: string }
  sourceDocument?: { title: string } | null
  solutions: Array<{
    id: string
    content: string
    authorType: string
    isVerified: boolean
  }>
}

interface ThreadItem {
  id: string
  title: string
  courseId: string | null
  course: { code: string; name: string } | null
  author: { name: string; role: string }
  _count: { posts: number }
}

interface AssignedCourse {
  id: string
  code: string
  name: string
  semester: number
  _count: { questions: number; documents: number; enrollments: number; forumThreads: number }
}

interface CRItem {
  id: string
  name: string
  email: string
  batch: { branch: string; year: number; group: string } | null
}

interface CalendarEventItem {
  id: string
  title: string
  type: string
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

interface BatchItem {
  id: string
  branch: string
  year: number
  group: string
}

interface TeacherDashboardClientProps {
  teacherName: string
  teacherEmail: string
  assignedCourses: AssignedCourse[]
  pendingQuestions: QuestionItem[]
  approvedCount: number
  activeThreads: ThreadItem[]
  allCRs: CRItem[]
  calendarEvents: CalendarEventItem[]
  allBatches: BatchItem[]
  initialTab?: 'courses' | 'doubts' | 'crs' | 'calendar'
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

export function TeacherDashboardClient({
  teacherName,
  teacherEmail,
  assignedCourses,
  pendingQuestions,
  approvedCount,
  activeThreads,
  allCRs: initialCRs,
  calendarEvents: initialEvents,
  allBatches,
  initialTab = 'courses',
}: TeacherDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'courses' | 'doubts' | 'crs' | 'calendar'>(initialTab)
  const [crList, setCrList] = useState<CRItem[]>(initialCRs)
  const [events, setEvents] = useState<CalendarEventItem[]>(initialEvents)

  useEffect(() => {
    setEvents(initialEvents)
  }, [initialEvents])
  const [confirmDeleteCR, setConfirmDeleteCR] = useState<CRItem | null>(null)
  const [removing, setRemoving] = useState(false)

  // Calendar filter & modal state
  const [filterType, setFilterType] = useState<string>('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState(assignedCourses[0]?.id || '')
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL')
  const [eventTitle, setEventTitle] = useState('')
  const [eventType, setEventType] = useState('MST')
  const [eventDate, setEventDate] = useState('')
  const [eventVenue, setEventVenue] = useState('')
  const [eventWeightage, setEventWeightage] = useState('30')
  const [eventNotes, setEventNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

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
    setSelectedCourseId(assignedCourses[0]?.id || '')
    setEventTitle('')
    setEventType('MST')
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

  // Handle adding / editing event by teacher
  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setModalError(null)

    try {
      if (!selectedCourseId) throw new Error('Please select a course.')
      if (!eventTitle.trim()) throw new Error('Please enter an event title.')
      if (!eventDate) throw new Error('Please select event date and time.')

      const matchedCourse = assignedCourses.find((c) => c.id === selectedCourseId)
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
          batchId: null, // Course-wide for all enrolled students
          title: eventTitle.trim(),
          type: eventType as any,
          start: new Date(eventDate).toISOString(),
          venue: eventVenue.trim() || undefined,
          syllabusTopicIds: [],
          weightage: parsedWeightage,
          notes: eventNotes.trim() || undefined,
        })

        const newEv: CalendarEventItem = {
          id: result.eventId,
          title: eventTitle.trim(),
          type: eventType,
          start: new Date(eventDate).toISOString(),
          venue: eventVenue.trim() || null,
          syllabusTopicIds: [],
          weightage: parsedWeightage ?? null,
          notes: eventNotes.trim() || null,
          isApproved: true,
          courseId: selectedCourseId,
          course: { code: matchedCourse?.code || 'COURSE', name: matchedCourse?.name || '' },
          batchId: null,
          batch: null,
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

  async function handleDeleteEvent(evId: string) {
    try {
      await deleteCalendarEvent(evId)
      setEvents((prev) => prev.filter((e) => e.id !== evId))
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }

  async function handleRemoveCR() {
    if (!confirmDeleteCR) return
    setRemoving(true)
    try {
      const res = await assignUserRoleAction(confirmDeleteCR.email, 'STUDENT')
      if (res.success) {
        setCrList((prev) => prev.filter((item) => item.id !== confirmDeleteCR.id))
      }
      setConfirmDeleteCR(null)
    } catch (err) {
      console.error('Failed to revoke CR:', err)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="space-y-6">
      <RealtimeSync channels={['calendar', 'forum']} />

      {/* ── Sleek Minimalist Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/50">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl sm:text-2xl tracking-tight text-foreground">
              Prof. {teacherName}
            </span>
            <Badge variant="destructive" className="text-[10px] uppercase font-semibold tracking-wider h-5 px-2">
              Faculty
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {teacherEmail}
          </p>
        </div>
      </div>

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
            <span>My Courses ({assignedCourses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('doubts')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'doubts'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Student Doubts</span>
            {activeThreads.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {activeThreads.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('crs')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'crs'
                ? 'bg-background shadow-xs text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Class Reps ({crList.length})</span>
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
        </div>

        {activeTab === 'calendar' && (
          <Button
            size="sm"
            onClick={() => openCreateModal()}
            className="brand-gradient text-white text-xs h-8 font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Event
          </Button>
        )}
      </div>

      {/* ── TAB 1: Assigned Courses ── */}
      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
          {assignedCourses.map((c) => (
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

      {/* ── TAB 2: Student Doubts ── */}
      {activeTab === 'doubts' && (
        <div className="space-y-3 animate-fade-in">
          {activeThreads.length === 0 ? (
            <Card className="border-dashed p-10 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="font-semibold text-foreground text-sm">All doubts answered!</p>
              <p className="mt-1">No unanswered student questions in your assigned subjects.</p>
            </Card>
          ) : (
            activeThreads.map((thread) => (
              <div
                key={thread.id}
                className="p-4 rounded-xl border border-border/60 bg-card hover:bg-secondary/30 transition-all flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {thread.course?.code || 'GENERAL'}
                    </span>
                    <h4 className="font-semibold text-sm truncate text-foreground">
                      {thread.title}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Asked by <strong className="text-foreground">{thread.author.name}</strong> • {thread._count.posts} response{thread._count.posts === 1 ? '' : 's'}
                  </p>
                </div>

                <Button asChild size="sm" className="brand-gradient text-white text-xs shrink-0 h-8">
                  <Link href={`/courses/${thread.courseId || ''}/discuss/${thread.id}?from=doubts`}>
                    Answer Doubt
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── TAB 3: Class Representatives Management ── */}
      {activeTab === 'crs' && (
        <div className="space-y-6 animate-fade-in">
          <AppointCRCard
            onAppointed={(newCR) => {
              setCrList((prev) => {
                if (prev.some((c) => c.id === newCR.id)) return prev
                return [newCR, ...prev]
              })
            }}
          />

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Class Representatives ({crList.length})
            </h3>

            {crList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No active Class Representatives appointed.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {crList.map((cr) => (
                  <div
                    key={cr.id}
                    className="p-3 rounded-xl border border-border/60 bg-card flex flex-col justify-between text-xs space-y-2.5 relative group hover:border-border transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 pr-6">
                        <div className="font-semibold text-foreground truncate">{cr.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate">{cr.email}</div>
                      </div>

                      {/* X Button to open removal dialog */}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCR(cr)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1 rounded-md transition-colors"
                        title={`Remove ${cr.name} as CR`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Sub-group:</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {cr.batch ? `${cr.batch.branch}-${cr.batch.group}` : 'General'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Confirmation Modal for Removing CR ── */}
          {confirmDeleteCR && (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
              <div className="w-full max-w-sm rounded-xl border border-border/80 bg-card p-5 shadow-xl space-y-4">
                <div className="space-y-1.5">
                  <h4 className="font-bold text-base text-foreground">Remove Class Representative?</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Are you sure you want to revoke CR privileges from{' '}
                    <strong className="text-foreground">{confirmDeleteCR.name}</strong> ({confirmDeleteCR.email})?
                    They will revert to a regular Student account.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setConfirmDeleteCR(null)}
                    disabled={removing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs h-8"
                    onClick={handleRemoveCR}
                    disabled={removing}
                  >
                    {removing ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Removing...
                      </>
                    ) : (
                      'Remove as CR'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: Academic Calendar ── */}
      {activeTab === 'calendar' && (
        <div className="animate-fade-in">
          <AcademicCalendarGrid
            events={events}
            role="TEACHER"
            assignedCourseIds={assignedCourses.map((c) => c.id)}
            onEditEvent={openEditModal}
            onDeleteEvent={handleDeleteEvent}
            onRequestAddEvent={(prefillDate) => openCreateModal(prefillDate)}
          />
        </div>
      )}

      {/* ── Schedule Event Modal for Teacher ── */}
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
                  ? 'Changes will update immediately on the academic calendar for enrolled students and CRs.'
                  : 'Event will be published immediately to the academic calendar for enrolled students and CRs.'}
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
                    {assignedCourses.map((c) => (
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
                    placeholder="e.g. MST, EST, Sessional 1, or Unit 2 Quiz"
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
                      <option value="MST">Mid-Semester Test (MST)</option>
                      <option value="EST">End-Semester Test (EST)</option>
                      <option value="SESSIONAL">Sessional</option>
                      <option value="QUIZ">Quiz</option>
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
                      'Publish Event'
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
