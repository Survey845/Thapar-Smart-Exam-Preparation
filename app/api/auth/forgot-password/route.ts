import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Please enter your institutional email.' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()
    if (!cleanEmail.endsWith('@thapar.edu')) {
      return NextResponse.json(
        { error: 'Only official @thapar.edu institutional email addresses are permitted.' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    })

    // To prevent user enumeration attacks, respond with success even if email not found
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, password reset instructions have been sent.',
      })
    }

    // Generate cryptographically secure reset token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour validity

    // Delete any existing reset tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: cleanEmail },
    })

    // Store new token
    await prisma.passwordResetToken.create({
      data: {
        email: cleanEmail,
        token,
        expiresAt,
      },
    })

    const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${origin}/reset-password?token=${token}`

    console.log(`\n🔑 [PASSWORD RESET] Link generated for ${cleanEmail}: ${resetUrl}\n`)

    return NextResponse.json({
      success: true,
      message: 'Password reset link generated successfully.',
      // Provided for seamless local testing without mandatory external mail server setup
      resetUrl,
    })
  } catch (err) {
    console.error('Forgot password API error:', err)
    return NextResponse.json(
      { error: 'Failed to process password reset request. Please try again.' },
      { status: 500 }
    )
  }
}

