import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { MockQuizRunner } from '@/components/quiz/MockQuizRunner'
import { Trophy } from 'lucide-react'

interface QuizPageProps {
  params: Promise<{ id: string }>
}

export default async function QuizPage({ params }: QuizPageProps) {
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

  const isModerator = session.user.role === 'MODERATOR'

  const questions = await prisma.question.findMany({
    where: {
      courseId: course.id,
      ...(isModerator ? {} : { isApproved: true }),
    },
    include: {
      solutions: {
        include: {
          author: { select: { name: true } },
        },
        orderBy: [{ isVerified: 'desc' }, { upvotes: 'desc' }],
      },
    },
    orderBy: { year: 'desc' },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border/60 pb-5">
        <h2 className="text-2xl font-bold tracking-tight">
          Mock Quiz
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Take a timed practice test built from authentic TIET past paper questions. Get an instant score and an AI-generated weak topic diagnostic report.
        </p>
      </div>

      <MockQuizRunner
        courseId={course.id}
        courseCode={course.code}
        questions={questions as any}
      />
    </div>
  )
}
