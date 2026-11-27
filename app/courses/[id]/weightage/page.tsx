import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { WeightageDashboard } from '@/components/analytics/WeightageDashboard'

interface WeightagePageProps {
  params: Promise<{ id: string }>
}

interface ComputedWeightage {
  id: string
  evalType: string
  topic: string
  frequencyScore: number
  marksShare: number
  yearTrend: Array<{ year: number; marks: number; count: number }>
  lastUpdated: Date
}

function computeWeightagesForBucket(
  evalType: string,
  bucket: Array<{
    id: string
    evalType: string
    year: number
    marks: number
    topicTags: string[]
    sourceDocId: string | null
  }>
): ComputedWeightage[] {
  if (bucket.length === 0) return []

  const paperKeys = new Set(
    bucket.map((q) => q.sourceDocId || `${q.evalType}-${q.year}`)
  )
  const totalPapers = Math.max(1, paperKeys.size)

  let totalMarks = 0
  const topicMap = new Map<
    string,
    {
      marks: number
      papers: Set<string>
      byYear: Map<number, { marks: number; count: number }>
    }
  >()

  for (const q of bucket) {
    const tags = q.topicTags.length > 0 ? q.topicTags : ['General']
    const paperKey = q.sourceDocId || `${q.evalType}-${q.year}`
    const marksPerTag = q.marks / tags.length
    totalMarks += q.marks

    for (const rawTag of tags) {
      const topic = rawTag.trim()
      if (!topic) continue

      let entry = topicMap.get(topic)
      if (!entry) {
        entry = { marks: 0, papers: new Set(), byYear: new Map() }
        topicMap.set(topic, entry)
      }

      entry.marks += marksPerTag
      entry.papers.add(paperKey)

      const yr = entry.byYear.get(q.year) || { marks: 0, count: 0 }
      yr.marks += marksPerTag
      yr.count += 1
      entry.byYear.set(q.year, yr)
    }
  }

  const safeTotalMarks = totalMarks > 0 ? totalMarks : 1
  const results: ComputedWeightage[] = []

  for (const [topic, entry] of topicMap.entries()) {
    const marksShare = Math.round((entry.marks / safeTotalMarks) * 1000) / 10
    const frequencyScore = Math.min(
      100,
      Math.round((entry.papers.size / totalPapers) * 100)
    )
    const yearTrend = Array.from(entry.byYear.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, stats]) => ({
        year,
        marks: Math.round(stats.marks * 10) / 10,
        count: stats.count,
      }))

    results.push({
      id: `${evalType}-${topic}`,
      evalType,
      topic,
      frequencyScore,
      marksShare,
      yearTrend,
      lastUpdated: new Date(),
    })
  }

  return results.sort((a, b) => b.marksShare - a.marksShare)
}

export default async function WeightagePage({ params }: WeightagePageProps) {
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

  // Compute deterministic topic weightages directly from approved questions extracted from uploaded resources
  const questions = await prisma.question.findMany({
    where: {
      courseId: course.id,
      isApproved: true,
    },
    select: {
      id: true,
      evalType: true,
      year: true,
      marks: true,
      topicTags: true,
      sourceDocId: true,
    },
  })

  const evalTypesPresent = Array.from(new Set(questions.map((q) => q.evalType)))
  const weightages: ComputedWeightage[] = [
    ...computeWeightagesForBucket('ALL', questions),
    ...evalTypesPresent.flatMap((et) =>
      computeWeightagesForBucket(
        et,
        questions.filter((q) => q.evalType === et)
      )
    ),
  ]

  const totalPapersAnalyzed = new Set(
    questions.map((q) => q.sourceDocId || `${q.evalType}-${q.year}`)
  ).size

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border/60 pb-5">
        <h2 className="text-2xl font-bold tracking-tight">
          Topic Weightage
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Historical frequency and marks share calculated across {totalPapersAnalyzed} uploaded past exam {totalPapersAnalyzed === 1 ? 'paper' : 'papers'} ({questions.length} questions).
        </p>
      </div>

      <WeightageDashboard
        courseId={course.id}
        courseCode={course.code}
        weightages={weightages}
      />
    </div>
  )
}
