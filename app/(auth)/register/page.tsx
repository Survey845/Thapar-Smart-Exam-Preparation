'use client'

import { useState } from 'react'
import { signIn, getProviders } from 'next-auth/react'
import Link from 'next/link'
import { AlertCircle, Loader2, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleSignUp() {
    setError(null)
    setGoogleLoading(true)
    try {
      const providers = await getProviders()
      if (!providers?.google) {
        setError(
          'Google SSO is not configured yet. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.'
        )
        setGoogleLoading(false)
        return
      }

      await signIn('google', { callbackUrl: '/dashboard' })
    } catch {
      setError('Unable to initiate Google Sign Up. Please try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-4 animate-fade-in">
      {/* ── Mode Switcher Tabs ── */}
      <div className="grid grid-cols-2 p-1 bg-secondary/60 rounded-xl border border-border/50 text-center text-sm font-medium">
        <Link
          href="/login"
          className="py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          Log In
        </Link>
        <span className="py-2 rounded-lg bg-background shadow-sm text-foreground font-semibold">
          Sign Up
        </span>
      </div>

      <Card className="shadow-xl border-border/60">
        <CardHeader className="space-y-1">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary mb-1">
            <Sparkles className="w-5 h-5" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Join Thapar Smart Exam Prep with your verified institute Google account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Google SSO Primary Action ── */}
          <div className="space-y-3">
            <Button
              type="button"
              className="w-full flex items-center justify-center gap-3 h-12 bg-white text-gray-900 border border-border/80 hover:bg-gray-50 shadow-sm font-semibold transition-all text-sm"
              onClick={handleGoogleSignUp}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              Sign Up with Google (@thapar.edu)
            </Button>
          </div>

          {/* ── Explanatory Callout ── */}
          <div className="rounded-xl border border-border/60 bg-muted/40 p-4 space-y-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Official Institutional Verification</span>
            </div>
            <p className="leading-relaxed">
              New accounts are created instantly using your official{' '}
              <strong className="text-foreground">@thapar.edu</strong> email. No separate password is required to get started.
            </p>
            <div className="pt-2 border-t border-border/50 flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>You can optionally set a custom password later in your Profile settings.</span>
            </div>
          </div>

          {/* ── Switch to Log In ── */}
          <div className="text-center pt-2 text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Log In here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
