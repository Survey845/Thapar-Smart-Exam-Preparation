'use client'

import { Suspense, useState } from 'react'
import { signIn, signOut, useSession, getProviders } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, LogIn, LogOut, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function LoginPageContent() {
  const router = useRouter()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'
  const urlError = searchParams.get('error')
  const registered = searchParams.get('registered')
  const resetSuccess = searchParams.get('reset')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Map URL error codes from NextAuth callbacks
  function getErrorMessage(): string | null {
    if (error) return error
    if (urlError === 'AccessDeniedThaparOnly') {
      return 'Access Restricted: Only official @thapar.edu Google accounts are permitted.'
    }
    if (urlError === 'DatabaseError') {
      return 'Cannot reach PostgreSQL database at localhost:5432. Please ensure your database is running.'
    }
    if (urlError === 'Configuration') {
      return 'Google SSO is not configured in .env yet. Please use institutional email below or configure GOOGLE_CLIENT_ID.'
    }
    if (urlError === 'OAuthSignin' || urlError === 'OAuthCallback') {
      return 'Google authentication failed or was cancelled. Please try again.'
    }
    if (urlError === 'CredentialsSignin') {
      return 'Invalid credentials. Please make sure you use your registered @thapar.edu email and correct password.'
    }
    return null
  }

  const activeError = getErrorMessage()

  async function handleGoogleSignIn() {
    setError(null)
    setGoogleLoading(true)
    try {
      const providers = await getProviders()
      if (!providers?.google) {
        setError(
          'Google SSO is not configured yet. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file, or use Email & Password below.'
        )
        setGoogleLoading(false)
        return
      }

      await signIn('google', { callbackUrl })
    } catch (err) {
      console.error(err)
      setError('Unable to initiate Google Sign-In.')
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanEmail = email.toLowerCase().trim()
    if (!cleanEmail.endsWith('@thapar.edu')) {
      setError('Only official @thapar.edu institutional email addresses are permitted.')
      return
    }

    setLoading(true)

    const result = await signIn('credentials', {
      email: cleanEmail,
      password,
      redirect: false,
      callbackUrl,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid credentials. Check your password or make sure your account is registered.')
    } else if (result?.url) {
      router.push(result.url)
      router.refresh()
    }
  }

  return (
    <div className="w-full max-w-md space-y-4 animate-fade-in">
      {/* ── Mode Switcher Tabs ── */}
      <div className="grid grid-cols-2 p-1 bg-secondary/60 rounded-xl border border-border/50 text-center text-sm font-medium">
        <span className="py-2 rounded-lg bg-background shadow-sm text-foreground font-semibold">
          Log In
        </span>
        <Link
          href="/register"
          className="py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign Up
        </Link>
      </div>

      {/* ── Login Card ── */}
      <Card className="shadow-xl border-border/60">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Log In</CardTitle>
          <CardDescription>
            Access your account with your <span className="font-semibold text-foreground">@thapar.edu</span> credentials
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Google SSO Button ── */}
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-3 h-11 border-border/80 hover:bg-secondary/60 font-medium transition-all"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            Log In with Google (@thapar.edu)
          </Button>

          {/* ── Divider ── */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-card px-2 text-muted-foreground font-semibold tracking-wider">
                Or log in with email
              </span>
            </div>
          </div>

          {registered && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Account created successfully! Please log in with your credentials.</span>
            </div>
          )}

          {resetSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Password has been reset successfully! You can now log in with your new password.</span>
            </div>
          )}

          {activeError && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Institute Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@thapar.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {/* Password with Forgot Password link */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full brand-gradient text-white shadow-md font-semibold h-11"
              disabled={loading || googleLoading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Log In
                </>
              )}
            </Button>
          </form>

          {/* Sign up prompt */}
          <div className="text-center text-xs text-muted-foreground pt-2">
            Don&apos;t have an account yet?{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Sign Up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md h-96 rounded-xl bg-card/50 animate-pulse" />}>
      <LoginPageContent />
    </Suspense>
  )
}
