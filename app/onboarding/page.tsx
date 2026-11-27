'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { GraduationCap, BookOpen, CheckCircle2, ArrowRight, Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBatch } from '@/lib/utils'

interface Batch {
  id: string
  branch: string
  year: number
  group: string
}

export default function OnboardingPage() {
  const { data: session, update } = useSession()
  const router = useRouter()

  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [loadingBatches, setLoadingBatches] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadBatches() {
      try {
        const res = await fetch('/api/batches')
        if (!res.ok) throw new Error('Failed to load batches')
        const data = await res.json()
        setBatches(data)
        if (data.length > 0) {
          setSelectedBatchId(data[0].id)
        }
      } catch (err) {
        console.error(err)
        setError('Failed to load academic batches. Please refresh the page.')
      } finally {
        setLoadingBatches(false)
      }
    }
    loadBatches()
  }, [])

  async function handleCompleteOnboarding(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBatchId) {
      setError('Please select your academic batch to continue.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: selectedBatchId }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update academic profile.')
      }

      // Update NextAuth JWT/Session on client
      await update({ batchId: selectedBatchId })

      // Navigate to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-12">
      {/* Brand header */}
      <div className="flex items-center gap-2 mb-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl brand-gradient shadow-lg">
          <GraduationCap className="h-6 w-6 text-white" />
        </span>
        <span className="text-2xl font-bold">
          <span className="text-primary">TIET</span>
          <span className="text-accent font-extrabold">Prep</span>
        </span>
      </div>

      <Card className="w-full max-w-lg shadow-xl border-border/60 animate-fade-in">
        <CardHeader className="space-y-1 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto mb-2">
            <BookOpen className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Welcome, <span className="font-semibold text-foreground">{session?.user?.name || 'Student'}</span>! Select your academic batch to personalize your exam calendar, weightage metrics, and study plans.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleCompleteOnboarding} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="batchSelect" className="text-sm font-medium">
                Academic Batch (Branch - Year - Subgroup)
              </label>

              {loadingBatches ? (
                <div className="flex items-center justify-center h-10 border border-border/60 rounded-md bg-muted/30 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading batches...
                </div>
              ) : (
                <select
                  id="batchSelect"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  {batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.branch} • Year {batch.year} • Group {batch.group} ({formatBatch(batch)})
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-muted-foreground">
                Your lab evaluation reminders and exam notifications will strictly isolate to this subgroup.
              </p>
            </div>

            <div className="bg-secondary/40 border border-border/60 rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Included in Your Setup
              </h4>
              <ul className="text-xs space-y-1.5 text-foreground/80">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Auto-enrollment into core subject: <strong className="text-foreground">UCS503 (Software Engineering)</strong>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Subgroup calendar synchronization with direct .ics export
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Full access to Question Bank, Grounded AI Assistant &amp; Discussion Forums
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full brand-gradient text-white shadow-md font-semibold h-11"
              disabled={saving || loadingBatches}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finalizing Setup...
                </>
              ) : (
                <>
                  Enter Platform
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Signed in as {session?.user?.email}</span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="inline-flex items-center text-destructive hover:underline"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Sign out
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

