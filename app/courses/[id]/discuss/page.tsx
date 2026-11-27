import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ThreadCard } from '@/components/forum/ThreadCard'
import { CreateThreadModal } from '@/components/forum/CreateThreadModal'
import { RealtimeSync } from '@/components/realtime/RealtimeSync'
import { resolveForumReportAction } from './actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, Flag, Trash2, CheckCircle2 } from 'lucide-react'

interface DiscussPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; tag?: string }>
}

export default async function DiscussPage({ params, searchParams }: DiscussPageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const { id } = await params
  const { q: questionFilter, tag: tagFilter } = await searchParams

  const [course, user] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { batch: true },
    }),
  ])

  if (!course || !user) {
    notFound()
  }

  const isModerator = user.role === 'MODERATOR'

  // Fetch threads for this course (+ open reports for Teachers/Moderators)
  const [threads, openReports] = await Promise.all([
    prisma.forumThread.findMany({
      where: {
        courseId: course.id,
        ...(questionFilter ? { questionId: questionFilter } : {}),
        ...(tagFilter ? { tags: { has: tagFilter } } : {}),
      },
      include: {
        author: { select: { name: true, role: true } },
        question: { select: { questionNumber: true, evalType: true, year: true } },
        _count: { select: { posts: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    }),
    isModerator
      ? prisma.forumReport.findMany({
          where: {
            courseId: course.id,
            status: 'OPEN',
          },
          include: {
            reporter: { select: { name: true } },
            thread: { select: { id: true, title: true, content: true, author: { select: { name: true } } } },
            post: {
              select: {
                id: true,
                content: true,
                threadId: true,
                author: { select: { name: true } },
                thread: { select: { title: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6 animate-fade-in">
      <RealtimeSync channels={['forum']} courseId={course.id} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Discussion Space
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Ask doubts, discuss past-paper questions, and collaborate with students across all subgroups in real time.
          </p>
        </div>

        <CreateThreadModal
          courseId={course.id}
          questionId={questionFilter}
        />
      </div>

      {/* ── Reported Content Moderation Queue (Teachers/Moderators Only) ── */}
      {isModerator && openReports.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-sm font-bold text-foreground">
                Reported Content for Review
              </h3>
              <Badge variant="destructive" className="text-[10px]">
                {openReports.length} open
              </Badge>
            </div>
          </div>

          <div className="space-y-2.5">
            {openReports.map((report) => {
              const isPostReport = Boolean(report.postId && report.post)
              const targetThreadId = report.post?.threadId || report.thread?.id
              const authorName = isPostReport
                ? report.post?.author.name
                : report.thread?.author.name

              return (
                <div
                  key={report.id}
                  className="p-3.5 rounded-lg border border-border/70 bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                        {isPostReport ? 'Reported Reply' : 'Reported Thread'}
                      </Badge>
                      <span className="text-muted-foreground">
                        Reported by <strong className="text-foreground">{report.reporter.name}</strong> (CR)
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        Reason: <strong className="text-foreground">{report.reason}</strong>
                      </span>
                    </div>

                    {isPostReport ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground line-clamp-2">
                          &ldquo;{report.post?.content}&rdquo;
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          By {authorName} in thread{' '}
                          {targetThreadId ? (
                            <Link
                              href={`/courses/${course.id}/discuss/${targetThreadId}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {report.post?.thread.title}
                            </Link>
                          ) : (
                            report.post?.thread.title
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {targetThreadId ? (
                          <Link
                            href={`/courses/${course.id}/discuss/${targetThreadId}`}
                            className="text-xs font-bold text-foreground hover:text-primary transition-colors"
                          >
                            {report.thread?.title}
                          </Link>
                        ) : (
                          <p className="text-xs font-bold text-foreground">{report.thread?.title}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          By {authorName} — {report.thread?.content}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <form
                      action={async () => {
                        'use server'
                        await resolveForumReportAction(report.id, 'DISMISS', course.id)
                      }}
                    >
                      <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Dismiss
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        'use server'
                        await resolveForumReportAction(report.id, 'DELETE_CONTENT', course.id)
                      }}
                    >
                      <Button type="submit" variant="destructive" size="sm" className="h-7 text-xs">
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {isPostReport ? 'Delete Reply' : 'Delete Thread'}
                      </Button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Threads Stream ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing <strong>{threads.length}</strong> discussion threads
          </span>
          {questionFilter && (
            <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
              Filtered by Linked Question
            </span>
          )}
        </div>

        {threads.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-border/70 space-y-3">
            <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold">No discussions yet</p>
            <p className="text-xs text-muted-foreground">
              Be the first to ask a doubt or post a solution note!
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                courseId={course.id}
                thread={thread as any}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
