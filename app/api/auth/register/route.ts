import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, password, batchId } = body

    // 1. Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 })
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Please enter your institutional email.' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()
    if (!cleanEmail.endsWith('@thapar.edu')) {
      return NextResponse.json(
        { error: 'Only official @thapar.edu emails are permitted.' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      )
    }

    if (!batchId || typeof batchId !== 'string') {
      return NextResponse.json(
        { error: 'Please select your academic batch.' },
        { status: 400 }
      )
    }

    // 2. Validate academic batch existence
    let batch
    try {
      batch = await prisma.batch.findUnique({
        where: { id: batchId },
      })

      if (!batch) {
        batch = await prisma.batch.findFirst()
        if (!batch) {
          batch = await prisma.batch.create({
            data: { branch: 'COE', year: 3, group: '3C72' },
          })
        }
      }
    } catch (dbErr) {
      console.error('Database connection error in register API:', dbErr)
      return NextResponse.json(
        { error: 'Cannot connect to the database. Please ensure PostgreSQL is running.' },
        { status: 503 }
      )
    }

    // 3. Prevent duplicate accounts
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this @thapar.edu email already exists. Please sign in.' },
        { status: 409 }
      )
    }

    // 4. Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10)

    // 5. Create user record
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        role: 'STUDENT',
        batchId: batch.id,
      },
    })

    // 6. Auto-enroll in default university courses (e.g. UCS503)
    try {
      const courses = await prisma.course.findMany({ take: 5 })
      for (const course of courses) {
        await prisma.enrollment.upsert({
          where: {
            userId_courseId: { userId: newUser.id, courseId: course.id },
          },
          create: {
            userId: newUser.id,
            courseId: course.id,
          },
          update: {},
        })
      }
    } catch (enrollErr) {
      console.error('Error auto-enrolling student:', enrollErr)
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration API error:', error)
    return NextResponse.json(
      { error: 'An error occurred during account creation. Please try again.' },
      { status: 500 }
    )
  }
}

