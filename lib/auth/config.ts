/**
 * Auth configuration — NextAuth options.
 *
 * Supports:
 *   1. Google Workspace SSO (@thapar.edu institutional domain restriction)
 *   2. CredentialsProvider (email + password login with bcrypt hash verification)
 *   3. DEV_AUTH mode for demo switching
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import type { Role } from '@prisma/client'

const providers: NextAuthOptions['providers'] = [
  // ── Credentials Provider (Institutional Email & Password) ────────────
  CredentialsProvider({
    name: 'TIET Email',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'you@thapar.edu' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null

      const email = credentials.email.toLowerCase().trim()

      // Enforce institutional @thapar.edu domain
      if (!email.endsWith('@thapar.edu')) {
        return null
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { batch: true },
      })

      if (!user) return null

      const isDev = process.env.DEV_AUTH === 'true'

      // In real/production mode, password verification is strictly required via bcrypt
      if (!user.passwordHash) {
        return null
      }

      const valid = await bcrypt.compare(credentials.password, user.passwordHash)
      if (!valid && !(isDev && credentials.password === 'demo123')) {
        return null
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        batchId: user.batchId ?? undefined,
      }
    },
  }),
]

// ── Google SSO Provider (Enabled if credentials are set in .env) ────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.unshift(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          hd: 'thapar.edu', // Suggest @thapar.edu in the Google account picker
          prompt: 'select_account',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    })
  )
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers,

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase().trim()

        // Strict server-side verification: reject any non-@thapar.edu address
        if (!email || !email.endsWith('@thapar.edu')) {
          return '/login?error=AccessDeniedThaparOnly'
        }

        try {
          // Fetch or auto-provision the user record in PostgreSQL
          let dbUser = await prisma.user.findUnique({
            where: { email },
            include: { batch: true },
          })

          if (!dbUser) {
            dbUser = await prisma.user.create({
              data: {
                name: user.name || email.split('@')[0],
                email,
                role: 'STUDENT',
              },
              include: { batch: true },
            })

            // Auto-enroll student into active default courses (e.g. UCS503)
            try {
              const courses = await prisma.course.findMany({ take: 5 })
              for (const course of courses) {
                await prisma.enrollment.upsert({
                  where: {
                    userId_courseId: { userId: dbUser.id, courseId: course.id },
                  },
                  create: {
                    userId: dbUser.id,
                    courseId: course.id,
                  },
                  update: {},
                })
              }
            } catch (enrollErr) {
              console.error('Error auto-enrolling new Google user:', enrollErr)
            }
          }

          user.id = dbUser.id
          ;(user as { role: Role }).role = dbUser.role
          ;(user as { batchId?: string }).batchId = dbUser.batchId ?? undefined
        } catch (dbError) {
          console.error('Database connection error during Google sign-in:', dbError)
          return '/login?error=DatabaseError'
        }
      }

      return true
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: Role }).role
        token.batchId = (user as { batchId?: string }).batchId
      }

      // Support dynamic session update (e.g., when completing onboarding batch selection)
      if (trigger === 'update' && session) {
        if (session.batchId !== undefined) {
          token.batchId = session.batchId
        }
        if (session.name) {
          token.name = session.name
        }
        if (session.role) {
          token.role = session.role
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.batchId = token.batchId as string | undefined
      }
      return session
    },
  },
}
