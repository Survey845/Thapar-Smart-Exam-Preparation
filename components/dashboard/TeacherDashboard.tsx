import { prisma } from '@/lib/db'
import { TeacherDashboardClient } from '@/components/dashboard/TeacherDashboardClient'

interface TeacherDashboardProps {
  teacherId: string
  teacherName: string
  teacherEmail: string
  initialTab?: 'courses' | 'doubts' | 'crs' | 'calendar'
}

export async function TeacherDashboard({
  teacherId,
  teacherName,
  teacherEmail,
  initialTab = 'courses',
}: TeacherDashboardProps) {
  // 1. Fetch courses assigned to this specific teacher
  let teacherAssignments = await prisma.teacherCourse.findMany({
    where: { teacherId },
    include: {
      course: {
        include: {
          _count: { select: { questions: true, enrollments: true, forumThreads: true, documents: true } },
        },
      },
    },
    orderBy: { course: { code: 'asc' } },
  })

  // If no course explicitly linked yet, link default course (UCS503)
  if (teacherAssignments.length === 0) {
    const defaultCourse = await prisma.course.findFirst({ where: { code: 'UCS503' } })
    if (defaultCourse) {
      await prisma.teacherCourse.create({
        data: { teacherId, courseId: defaultCourse.id },
      })
      teacherAssignments = await prisma.teacherCourse.findMany({
        where: { teacherId },
        include: {
          course: {
            include: {
              _count: { select: { questions: true, enrollments: true, forumThreads: true, documents: true } },
            },
          },
        },
      })
    }
  }

  const assignedCourses = teacherAssignments.map((a) => a.course)
  const assignedCourseIds = assignedCourses.map((c) => c.id)

  // 2. Fetch questions, doubts, CRs, batches, and calendar events for these specific subjects
  const [pendingQuestions, approvedCount, activeThreads, allCRs, calendarEvents, allBatches] = await Promise.all([
    prisma.question.findMany({
      where: {
        isApproved: false,
        courseId: { in: assignedCourseIds },
      },
      include: {
        course: { select: { code: true, name: true } },
        sourceDocument: { select: { title: true } },
        solutions: {
          select: { id: true, content: true, authorType: true, isVerified: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.question.count({
      where: {
        isApproved: true,
        courseId: { in: assignedCourseIds },
      },
    }),
    prisma.forumThread.findMany({
      where: {
        courseId: { in: assignedCourseIds },
      },
      take: 6,
      orderBy: { updatedAt: 'desc' },
      include: {
        course: { select: { code: true, name: true } },
        author: { select: { name: true, role: true } },
        _count: { select: { posts: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: 'CR' },
      select: {
        id: true,
        name: true,
        email: true,
        batch: { select: { branch: true, year: true, group: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.calendarEvent.findMany({
      where: {
        courseId: { in: assignedCourseIds },
      },
      include: {
        course: { select: { code: true, name: true } },
        batch: { select: { branch: true, year: true, group: true } },
      },
      orderBy: { start: 'asc' },
    }),
    prisma.batch.findMany({
      orderBy: [{ branch: 'asc' }, { group: 'asc' }],
    }),
  ])

  return (
    <TeacherDashboardClient
      teacherName={teacherName}
      teacherEmail={teacherEmail}
      assignedCourses={assignedCourses}
      pendingQuestions={pendingQuestions}
      approvedCount={approvedCount}
      activeThreads={activeThreads}
      allCRs={allCRs}
      calendarEvents={calendarEvents}
      allBatches={allBatches}
      initialTab={initialTab}
    />
  )
}
