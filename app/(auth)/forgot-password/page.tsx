'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, AlertCircle, CheckCircle2, Loader2, KeyRound, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [resetUrl, setResetUrl] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setResetUrl(null)

    const cleanEmail = email.toLowerCase().trim()
    if (!cleanEmail.endsWith('@thapar.edu')) {
      setError('Please enter your official @thapar.edu institutional email address.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request.')
      }

      setSuccess(data.message)
      if (data.resetUrl) {
        setResetUrl(data.resetUrl)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-4 animate-fade-in">
      <Card className="shadow-xl border-border/60">
        <CardHeader className="space-y-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary mb-1">
            <KeyRound className="w-5 h-5" />
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            Enter your <span className="font-semibold text-foreground">@thapar.edu</span> email to receive password reset instructions
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>

              {resetUrl && (
                <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                  <p className="text-xs font-semibold text-primary">
                    ⚡ Instant Reset Link (Local Development Mode):
                  </p>
                  <Link
                    href={resetUrl}
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-mono underline hover:text-primary/80 break-all"
                  >
                    Open Password Reset Form
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Institute Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="rollnumber@thapar.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full brand-gradient text-white shadow-md font-semibold h-11"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating link...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Reset Instructions
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

