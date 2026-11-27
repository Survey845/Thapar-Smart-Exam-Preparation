import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // Redirect root to dashboard
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Block non-moderators from /admin
    if (pathname.startsWith('/admin') && token?.role !== 'MODERATOR') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Redirect students without a batch to /onboarding
    if (
      token?.role === 'STUDENT' &&
      !token?.batchId &&
      !pathname.startsWith('/onboarding') &&
      !pathname.startsWith('/api')
    ) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }

    // If student already has a batch, prevent lingering on /onboarding
    if (token?.batchId && pathname.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl
        // Allow unauthenticated visitors to access login, registration, public APIs, and password recovery pages
        if (
          pathname.startsWith('/login') ||
          pathname.startsWith('/register') ||
          pathname.startsWith('/forgot-password') ||
          pathname.startsWith('/reset-password') ||
          pathname.startsWith('/api/batches')
        ) {
          return true
        }
        return !!token
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  // Protect all page routes except APIs, static files, and public auth screens
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|register|forgot-password|reset-password).*)',
  ],
}
