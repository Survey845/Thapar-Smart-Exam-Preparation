import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { batchId } = body

    if (!batchId || typeof batchId !== 'string') {
      return NextResponse.json({ error: 'Please select a valid academic batch.' }, { status: 400 })
    }

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Invalid batch selected.' }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { batchId: batch.id },
      include: { batch: true },
    })

    // Auto-enroll based on Year & Pool (Pool A / Pool B for Year 1, Software Engineering for Year 3)
    try {
      let targetCodes: string[] = []
      const groupUpper = batch.group.toUpperCase()

      if (batch.year === 1 && groupUpper.includes('A')) {
        targetCodes = ['UCH101', 'UEE001', 'UEN008', 'UES103', 'UMA022']
      } else if (batch.year === 1 && groupUpper.includes('B')) {
        targetCodes = ['UHU003', 'UPH013', 'UTA015', 'UTA026', 'UMA023']
      } else if (batch.year === 3) {
        targetCodes = ['UCS503']
      }

      const courses =
        targetCodes.length > 0
          ? await prisma.course.findMany({ where: { code: { in: targetCodes } } })
          : await prisma.course.findMany({ where: { code: 'UCS503' } })

      for (const course of courses) {
        await prisma.enrollment.upsert({
          where: {
            userId_courseId: { userId: updatedUser.id, courseId: course.id },
          },
          create: {
            userId: updatedUser.id,
            courseId: course.id,
          },
          update: {},
        })
      }
    } catch (enrollErr) {
      console.error('Error auto-enrolling student on onboarding:', enrollErr)
    }

    return NextResponse.json({
      success: true,
      batch: updatedUser.batch,
    })
  } catch (error) {
    console.error('Onboarding API error:', error)
    return NextResponse.json(
      { error: 'Failed to update academic profile.' },
      { status: 500 }
    )
  }
}

