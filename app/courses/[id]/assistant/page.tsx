import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { AssistantChat } from '@/components/assistant/AssistantChat'

interface AssistantPageProps {
  params: Promise<{ id: string }>
}

export default async function AssistantPage({ params }: AssistantPageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const { id } = await params

  const course = await prisma.course.findUnique({
    where: { id },
  })

  if (!course) {
    notFound()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Headline Header ── */}
      <div className="border-b border-border/60 pb-5">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          TIET - AI
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Ask doubts, revise core concepts, or practice exam-style questions for {course.code} ({course.name}).
        </p>
      </div>

      <AssistantChat
        courseId={course.id}
        courseCode={course.code}
        courseName={course.name}
      />
    </div>
  )
}
