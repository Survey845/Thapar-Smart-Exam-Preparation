'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { EventType } from '@prisma/client'
import { publishRealtimeEvent } from '@/lib/realtime/bus'

export async function createCalendarEvent(data: {
  courseId: string
  batchId?: string | null
  title: string
  type: EventType
  start: string
  venue?: string
  syllabusTopicIds: string[]
  weightage?: number
  notes?: string
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Please sign in to schedule events.')
  }

  const role = session.user.role

  if (role !== 'CR' && role !== 'MODERATOR') {
    throw new Error('Only Class Representatives (CR) or Faculty can schedule calendar events.')
  }

  // 1. CR Rules: Can ONLY schedule Lab Evaluations for their OWN sub-group/batch
  if (role === 'CR') {
    const allowedCREventTypes: EventType[] = ['LAB_EVAL']
    if (!allowedCREventTypes.includes(data.type)) {
      throw new Error('Class Representatives can only schedule Lab Evaluations.')
    }
    if (!session.user.batchId) {
      throw new Error('Your user account is not assigned to a specific batch/sub-group.')
    }
  }

  // 2. Teacher (MODERATOR) Rules: Can schedule course-wide EST, MST, Sessionals, and Quizzes for their assigned subject
  if (role === 'MODERATOR') {
    const allowedTeacherEventTypes: EventType[] = ['MST', 'EST', 'SESSIONAL', 'QUIZ']
    if (!allowedTeacherEventTypes.includes(data.type)) {
      throw new Error('Faculty can only schedule MST, EST, Sessional, and Quiz evaluations.')
    }

    // Verify teacher is assigned to this course
    const isAssigned = await prisma.teacherCourse.findFirst({
      where: { teacherId: session.user.id, courseId: data.courseId },
    })
    if (!isAssigned) {
      throw new Error('You are not assigned as an instructor for this subject code.')
    }
  }

  // CR events are automatically locked to their own batchId; Teachers schedule course-wide (batchId = null)
  const batchId = role === 'CR' ? session.user.batchId : null

  const event = await prisma.calendarEvent.create({
    data: {
      courseId: data.courseId,
      batchId,
      title: data.title,
      type: data.type,
      start: new Date(data.start),
      venue: data.venue,
      syllabusTopicIds: data.syllabusTopicIds,
      weightage: data.weightage,
      notes: data.notes,
      isApproved: true,
      createdById: session.user.id,
    },
  })

  revalidatePath(`/courses/${data.courseId}/calendar`)
  revalidatePath('/dashboard')
  publishRealtimeEvent('calendar', { courseId: data.courseId })

  return { success: true, eventId: event.id, isApproved: true, createdById: session.user.id }
}

export async function deleteCalendarEvent(eventId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Please sign in to remove events.')
  }

  const role = session.user.role
  if (role !== 'CR' && role !== 'MODERATOR') {
    throw new Error('You do not have permission to delete calendar events.')
  }

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
  })

  if (!event) {
    throw new Error('Event not found.')
  }

  if (role === 'MODERATOR') {
    const allowedTeacherTypes: EventType[] = ['EST', 'MST', 'SESSIONAL', 'QUIZ']
    if (!allowedTeacherTypes.includes(event.type)) {
      throw new Error('Faculty can only remove EST, MST, Sessional, or Quiz events.')
    }

    const isAssigned = await prisma.teacherCourse.findFirst({
      where: { teacherId: session.user.id, courseId: event.courseId },
    })
    if (!isAssigned) {
      throw new Error('You can only remove events for courses you teach.')
    }
  } else if (role === 'CR') {
    if (event.type !== 'LAB_EVAL') {
      throw new Error('Class Representatives can only remove Lab Evaluation events.')
    }
    if (event.createdById !== session.user.id) {
      throw new Error('You can only remove Lab Evaluation events that you added.')
    }
  }

  await prisma.calendarEvent.delete({
    where: { id: eventId },
  })

  revalidatePath(`/courses/${event.courseId}/calendar`)
  revalidatePath('/dashboard')
  publishRealtimeEvent('calendar', { courseId: event.courseId })

  return { success: true }
}

export async function updateCalendarEvent(
  eventId: string,
  data: {
    courseId: string
    title: string
    type: EventType
    start: string
    venue?: string
    weightage?: number | null
    notes?: string
  }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Please sign in to edit events.')
  }

  const role = session.user.role
  if (role !== 'CR' && role !== 'MODERATOR') {
    throw new Error('You do not have permission to edit calendar events.')
  }

  const existing = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
  })

  if (!existing) {
    throw new Error('Event not found.')
  }

  if (role === 'MODERATOR') {
    const allowedTeacherTypes: EventType[] = ['EST', 'MST', 'SESSIONAL', 'QUIZ']
    if (!allowedTeacherTypes.includes(existing.type) || !allowedTeacherTypes.includes(data.type)) {
      throw new Error('Faculty can only edit EST, MST, Sessional, or Quiz events.')
    }

    const [teachesExisting, teachesTarget] = await Promise.all([
      prisma.teacherCourse.findFirst({
        where: { teacherId: session.user.id, courseId: existing.courseId },
      }),
      prisma.teacherCourse.findFirst({
        where: { teacherId: session.user.id, courseId: data.courseId },
      }),
    ])

    if (!teachesExisting || !teachesTarget) {
      throw new Error('You can only edit events for courses you teach.')
    }
  } else if (role === 'CR') {
    if (existing.type !== 'LAB_EVAL' || data.type !== 'LAB_EVAL') {
      throw new Error('Class Representatives can only edit Lab Evaluation events.')
    }
    if (existing.createdById !== session.user.id) {
      throw new Error('You can only edit Lab Evaluation events that you added.')
    }
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: eventId },
    data: {
      courseId: data.courseId,
      title: data.title,
      type: data.type,
      start: new Date(data.start),
      venue: data.venue || null,
      weightage: data.weightage ?? null,
      notes: data.notes || null,
    },
  })

  revalidatePath(`/courses/${existing.courseId}/calendar`)
  revalidatePath(`/courses/${updated.courseId}/calendar`)
  revalidatePath('/dashboard')
  publishRealtimeEvent('calendar', { courseId: updated.courseId })

  return { success: true, eventId: updated.id }
}

export async function approveCalendarEvent(eventId: string, courseId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user || (session.user.role !== 'CR' && session.user.role !== 'MODERATOR')) {
    throw new Error('Only Class Representatives (CR) or Faculty can approve events.')
  }

  await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { isApproved: true },
  })

  revalidatePath(`/courses/${courseId}/calendar`)
  revalidatePath('/dashboard')
  publishRealtimeEvent('calendar', { courseId })
  return { success: true }
}
