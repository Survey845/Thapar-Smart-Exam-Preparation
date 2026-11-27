import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { TeacherDashboard } from '@/components/dashboard/TeacherDashboard'
import { StudentDashboardClient } from '@/components/dashboard/StudentDashboardClient'

interface DashboardPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { tab } = await searchParams
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard')
  }

  // Fetch user profile with batch and enrolled courses
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      batch: true,
      enrollments: {
        include: {
          course: true,
        },
      },
    },
  })

  if (!user) {
    redirect('/login')
  }

  // ── Render Dedicated Teacher Console for Faculty ──
  if (user.role === 'MODERATOR') {
    const teacherInitialTab =
      tab === 'doubts' || tab === 'crs' || tab === 'calendar'
        ? tab
        : 'courses'

    return (
      <div className="container mx-auto max-w-7xl px-4 py-8 animate-fade-in">
        <TeacherDashboard
          teacherId={user.id}
          teacherName={user.name}
          teacherEmail={user.email}
          initialTab={teacherInitialTab}
        />
      </div>
    )
  }

  const enrolledCourses = user.enrollments.map((e) => e.course)
  const courseIds = enrolledCourses.map((c) => c.id)

  const [allCatalogCourses, allEvents] = await Promise.all([
    prisma.course.findMany({
      orderBy: { code: 'asc' },
    }),
    prisma.calendarEvent.findMany({
      where: {
        courseId: { in: courseIds },
        OR: [
          { batchId: null }, // course-wide events (MST, EST, etc.)
          ...(user.batchId ? [{ batchId: user.batchId }] : []),
        ],
        isApproved: true,
      },
      include: {
        course: { select: { code: true, name: true } },
        batch: { select: { branch: true, year: true, group: true } },
      },
      orderBy: { start: 'asc' },
    }),
  ])

  const initialTab: 'courses' | 'calendar' | 'catalog' =
    tab === 'calendar' || tab === 'catalog' ? tab : 'courses'

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <StudentDashboardClient
        userId={user.id}
        userName={user.name}
        userEmail={user.email}
        userRole={user.role as 'STUDENT' | 'CR'}
        userBatch={user.batch}
        userBatchId={user.batchId}
        enrolledCourses={enrolledCourses}
        allCatalogCourses={allCatalogCourses}
        allEvents={allEvents}
        initialTab={initialTab}
      />
    </div>
  )
}
