import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles,
  BookOpen,
  ExternalLink,
  FolderOpen,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CourseOverviewPageProps {
  params: Promise<{ id: string }>
}

export default async function CourseOverviewPage({ params }: CourseOverviewPageProps) {
  const { id } = await params

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      syllabusUnits: {
        where: { unitNumber: 0 },
        take: 1,
      },
      documents: {
        where: { type: 'SYLLABUS' },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          documents: true,
          questions: { where: { isApproved: true } },
        },
      },
    },
  })

  if (!course) {
    notFound()
  }

  const overviewParagraph = course.syllabusUnits[0]?.description || null
  const syllabusDoc = course.documents[0] || null
  const syllabusUrl =
    syllabusDoc?.fileUrl && syllabusDoc.fileUrl.startsWith('http')
      ? syllabusDoc.fileUrl
      : null

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Banner: Exam Prep Spotlight ── */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-accent/10 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Prepare for {course.code} with TIET Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">
            Explore past exam papers, discover historically high-yield topics, and practice with our retrieval-grounded AI tutor for {course.name}.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <Button asChild className="brand-gradient text-white border-0 shadow-sm">
            <Link href={`/courses/${course.id}/assistant`}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Launch TIET - AI
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Course Syllabus Overview ── */}
      <Card className="border-border/70">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Course Overview
          </CardTitle>

          {syllabusUrl && (
            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
              <a href={syllabusUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                View Syllabus
              </a>
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {overviewParagraph ? (
            <p className="text-sm text-foreground/90 leading-relaxed">
              {overviewParagraph}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">
              No syllabus PDF has been uploaded for {course.code} ({course.name}) yet. Once a syllabus is added under Resources, a concise course overview will appear here.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
            <Link
              href={`/courses/${course.id}/resources`}
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
              <span>
                <strong className="text-foreground">{course._count.documents}</strong> uploaded resources
              </span>
            </Link>
            <Link
              href={`/courses/${course.id}/questions`}
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
              <span>
                <strong className="text-foreground">{course._count.questions}</strong> extracted exam questions
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
