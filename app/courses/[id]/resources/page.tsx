import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import {
  FileText,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  ArrowUpRight,
  ExternalLink,
  Download,
  BookOpen,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AddResourceModal } from './AddResourceModal'

interface ResourcesPageProps {
  params: Promise<{ id: string }>
}

const EVAL_TYPE_LABELS: Record<string, string> = {
  MST: 'MST',
  EST: 'EST',
  QUIZ: 'Quiz',
  LAB_EVAL: 'Lab Evaluation',
  SESSIONAL: 'Sessional',
  VIVA: 'Viva',
  ASSIGNMENT: 'Assignment',
}

export default async function ResourcesPage({ params }: ResourcesPageProps) {
  const session = await getServerSession(authOptions)
  const isTeacher = session?.user?.role === 'MODERATOR'

  const { id } = await params

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      documents: {
        include: {
          uploader: { select: { name: true, role: true } },
          _count: { select: { questions: true, slideChunks: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!course) {
    notFound()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        )
      case 'NEEDS_REVIEW':
        return (
          <Badge variant="warning" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Needs Review
          </Badge>
        )
      case 'PARSING':
        return (
          <Badge variant="secondary" className="text-xs">
            Parsing / OCR
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Queued
          </Badge>
        )
    }
  }

  function getCleanLink(url: string) {
    if (!url) return null
    if (url.startsWith('seed-data/')) {
      return null
    }
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsed = new URL(url)
        // Fully decode pathname first to prevent any %25 double encoding
        let path = parsed.pathname
        try {
          while (path.includes('%')) {
            const next = decodeURIComponent(path)
            if (next === path) break
            path = next
          }
        } catch {
          // keep path as is if malformed
        }
        return `${parsed.origin}${encodeURI(path)}`
      }
      return url
    } catch {
      return url
    }
  }

  function formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return ''
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return ` • ${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Course Materials &amp; Resources</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {course.code} — {course.name} • {course.documents.length} resource{course.documents.length === 1 ? '' : 's'} available
          </p>
        </div>

        {isTeacher && (
          <AddResourceModal courseId={course.id} />
        )}
      </div>

      {/* ── Document List ── */}
      {course.documents.length === 0 ? (
        <Card className="border-dashed p-10 text-center space-y-3">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-semibold">No materials uploaded yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Resources added by faculty or imported from Cloudflare R2 will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {course.documents.map((doc) => {
            const cleanUrl = getCleanLink(doc.fileUrl)

            return (
              <Card key={doc.id} className="border-border/70 hover:shadow-sm transition-shadow flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="font-mono text-xs">
                        {doc.type}
                      </Badge>
                      {doc.evalType && (
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {EVAL_TYPE_LABELS[doc.evalType] || doc.evalType}
                        </Badge>
                      )}
                      {doc.year && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {doc.year}
                        </Badge>
                      )}
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>

                  <CardTitle className="text-base font-bold mt-2 leading-snug">
                    {doc.title}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Uploaded by {doc.uploader.name} ({doc.uploader.role})
                    {formatBytes(doc.fileSize)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 text-xs text-muted-foreground border-t border-border/50 pt-3 flex items-center justify-between">
                  <span className="text-[11px]">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>

                  {cleanUrl ? (
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5">
                        <a
                          href={cleanUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      </Button>
                      <Button asChild size="sm" className="brand-gradient text-white h-7 text-xs px-2.5">
                        <a
                          href={cleanUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[11px] italic text-muted-foreground">Local Seed Mock</span>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
