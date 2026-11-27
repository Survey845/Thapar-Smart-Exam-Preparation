'use client'

import { useState } from 'react'
import { Flag, X, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { reportForumContentAction } from '@/app/courses/[id]/discuss/actions'

interface ReportButtonProps {
  courseId: string
  threadId?: string
  postId?: string
  targetLabel: 'Thread' | 'Reply'
}

const PRESET_REASONS = [
  'Inappropriate or abusive language',
  'Spam or off-topic content',
  'Harassment or personal attack',
  'Misleading or fake exam information',
]

export function ReportButton({
  courseId,
  threadId,
  postId,
  targetLabel,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(PRESET_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reported, setReported] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const finalReason = reason === 'OTHER' ? customReason.trim() : reason
    if (!finalReason) {
      setError('Please provide a reason for reporting.')
      setSubmitting(false)
      return
    }

    try {
      await reportForumContentAction({
        courseId,
        threadId,
        postId,
        reason: finalReason,
      })
      setReported(true)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report.')
    } finally {
      setSubmitting(false)
    }
  }

  if (reported) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 px-2 py-0.5">
        <Check className="h-3 w-3" />
        Reported
      </span>
    )
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-[11px] h-7 px-2 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
        title={`Report ${targetLabel} to Faculty`}
      >
        <Flag className="h-3 w-3 mr-1" />
        Report
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md border-border/80 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-5 border-b border-border/50">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-500" />
                Report {targetLabel} to Faculty
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                This will flag the {targetLabel.toLowerCase()} for Teachers/Moderators to review inside Discussion Space.
              </p>
            </div>

            <CardContent className="p-5">
              {error && (
                <div className="mb-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Reason</label>
                  <div className="space-y-1.5">
                    {PRESET_REASONS.map((preset) => (
                      <label
                        key={preset}
                        className="flex items-center gap-2 p-2 rounded-lg border border-border/60 hover:bg-secondary/40 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="report-reason"
                          value={preset}
                          checked={reason === preset}
                          onChange={() => setReason(preset)}
                          className="accent-primary"
                        />
                        <span>{preset}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 p-2 rounded-lg border border-border/60 hover:bg-secondary/40 cursor-pointer">
                      <input
                        type="radio"
                        name="report-reason"
                        value="OTHER"
                        checked={reason === 'OTHER'}
                        onChange={() => setReason('OTHER')}
                        className="accent-primary"
                      />
                      <span>Other</span>
                    </label>
                  </div>
                </div>

                {reason === 'OTHER' && (
                  <textarea
                    rows={2}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Describe why this content is inappropriate..."
                    className="w-full p-2.5 rounded-md border border-input bg-background text-xs"
                    required
                  />
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs px-4"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Reporting...
                      </>
                    ) : (
                      'Submit Report'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

