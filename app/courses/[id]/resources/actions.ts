'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { DocType, EvalType } from '@prisma/client'

export async function addCourseResourceAction(data: {
  courseId: string
  title: string
  type: DocType
  evalType?: EvalType
  year?: number
  session?: string
  fileUrl: string
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'MODERATOR') {
    throw new Error('Only teachers and moderators can publish course resources.')
  }

  const newDoc = await prisma.document.create({
    data: {
      courseId: data.courseId,
      uploaderId: session.user.id,
      title: data.title.trim(),
      type: data.type,
      evalType: data.evalType || null,
      year: data.year || new Date().getFullYear(),
      session: data.session || 'Odd',
      fileUrl: data.fileUrl.trim(),
      status: 'APPROVED', // Teacher uploaded resources are instantly verified and approved
    },
  })

  revalidatePath(`/courses/${data.courseId}/resources`)
  revalidatePath(`/courses/${data.courseId}`)
  revalidatePath('/dashboard')

  return { success: true, documentId: newDoc.id }
}

