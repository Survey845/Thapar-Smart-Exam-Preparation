'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { getLLMProvider } from '@/lib/llm'
import { hybridRetrieve } from '@/lib/vector/hybrid'
import { publishRealtimeEvent } from '@/lib/realtime/bus'

export async function createThreadAction(data: {
  courseId?: string
  questionId?: string
  title: string
  content: string
  tags: string[]
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Please sign in to start a discussion.')
  }

  const thread = await prisma.forumThread.create({
    data: {
      courseId: data.courseId || null,
      questionId: data.questionId || null,
      authorId: session.user.id,
      title: data.title.trim(),
      content: data.content.trim(),
      tags: data.tags,
    },
  })

  if (data.courseId) {
    revalidatePath(`/courses/${data.courseId}/discuss`)
  }
  revalidatePath('/dashboard')
  publishRealtimeEvent('forum', { courseId: data.courseId, threadId: thread.id })

  return { threadId: thread.id }
}

export async function createPostAction(data: {
  threadId: string
  content: string
  courseId: string
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Please sign in to reply.')
  }

  const post = await prisma.forumPost.create({
    data: {
      threadId: data.threadId,
      authorId: session.user.id,
      content: data.content.trim(),
    },
  })

  revalidatePath(`/courses/${data.courseId}/discuss`)
  revalidatePath(`/courses/${data.courseId}/discuss/${data.threadId}`)
  revalidatePath('/dashboard')
  publishRealtimeEvent('forum', { courseId: data.courseId, threadId: data.threadId })
  return { postId: post.id }
}

export async function votePostAction(postId: string, isUpvote: boolean) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Please sign in to vote.')
  }

  const updatedPost = await prisma.forumPost.update({
    where: { id: postId },
    data: {
      upvotes: { [isUpvote ? 'increment' : 'decrement']: 1 },
    },
    include: { thread: { select: { id: true, courseId: true } } },
  })

  if (updatedPost.thread.courseId) {
    revalidatePath(`/courses/${updatedPost.thread.courseId}/discuss/${updatedPost.thread.id}`)
  }
  publishRealtimeEvent('forum', {
    courseId: updatedPost.thread.courseId || undefined,
    threadId: updatedPost.thread.id,
  })

  return { success: true }
}

export async function markAcceptedAnswerAction(
  threadId: string,
  postId: string,
  courseId: string
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const thread = await prisma.forumThread.findUnique({
    where: { id: threadId },
  })

  // Author or moderator can accept
  const isAuthor = thread?.authorId === session.user.id
  const isModerator = session.user.role === 'MODERATOR'

  if (!isAuthor && !isModerator) {
    throw new Error('Only the thread author or a moderator can mark the accepted answer.')
  }

  // Clear previous accepted
  await prisma.forumPost.updateMany({
    where: { threadId, isAccepted: true },
    data: { isAccepted: false },
  })

  await prisma.forumPost.update({
    where: { id: postId },
    data: { isAccepted: true },
  })

  await prisma.forumThread.update({
    where: { id: threadId },
    data: { acceptedPostId: postId },
  })

  revalidatePath(`/courses/${courseId}/discuss/${threadId}`)
  publishRealtimeEvent('forum', { courseId, threadId })
  return { success: true }
}

export async function moderateThreadAction(
  threadId: string,
  action: 'PIN' | 'LOCK' | 'DELETE',
  courseId: string
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    throw new Error('Please sign in to perform moderation actions.')
  }

  const role = session.user.role
  if (action === 'PIN') {
    if (role !== 'MODERATOR' && role !== 'CR') {
      throw new Error('Only Teachers or Class Representatives (CR) can pin or unpin discussions.')
    }
  } else if (role !== 'MODERATOR') {
    throw new Error('Only Teachers can perform this moderation action.')
  }

  if (action === 'DELETE') {
    await prisma.forumThread.delete({
      where: { id: threadId },
    })
  } else if (action === 'PIN') {
    const thread = await prisma.forumThread.findUnique({ where: { id: threadId } })
    await prisma.forumThread.update({
      where: { id: threadId },
      data: { isPinned: !thread?.isPinned },
    })
  } else if (action === 'LOCK') {
    const thread = await prisma.forumThread.findUnique({ where: { id: threadId } })
    await prisma.forumThread.update({
      where: { id: threadId },
      data: { isLocked: !thread?.isLocked },
    })
  }

  revalidatePath(`/courses/${courseId}/discuss`)
  revalidatePath(`/courses/${courseId}/discuss/${threadId}`)
  revalidatePath('/dashboard')
  publishRealtimeEvent('forum', { courseId, threadId })
  return { success: true }
}

export async function deletePostAction(postId: string, courseId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Please sign in to delete replies.')
  }

  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    include: { thread: { select: { id: true, acceptedPostId: true } } },
  })

  if (!post) {
    throw new Error('Reply not found.')
  }

  const isOwner = post.authorId === session.user.id
  const isModerator = session.user.role === 'MODERATOR'

  if (!isOwner && !isModerator) {
    throw new Error('You can only delete your own replies.')
  }

  if (post.thread.acceptedPostId === postId) {
    await prisma.forumThread.update({
      where: { id: post.thread.id },
      data: { acceptedPostId: null },
    })
  }

  await prisma.forumPost.delete({
    where: { id: postId },
  })

  revalidatePath(`/courses/${courseId}/discuss`)
  revalidatePath(`/courses/${courseId}/discuss/${post.threadId}`)
  revalidatePath('/dashboard')
  publishRealtimeEvent('forum', { courseId, threadId: post.threadId })

  return { success: true }
}

export async function reportForumContentAction(data: {
  courseId: string
  threadId?: string
  postId?: string
  reason: string
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'CR') {
    throw new Error('Only Class Representatives (CR) can report forum content to Faculty.')
  }

  if (!data.threadId && !data.postId) {
    throw new Error('A thread or reply must be specified.')
  }

  const existing = await prisma.forumReport.findFirst({
    where: {
      courseId: data.courseId,
      reporterId: session.user.id,
      status: 'OPEN',
      ...(data.postId ? { postId: data.postId } : { threadId: data.threadId, postId: null }),
    },
  })

  if (existing) {
    throw new Error('You have already reported this item.')
  }

  await prisma.forumReport.create({
    data: {
      courseId: data.courseId,
      threadId: data.threadId || null,
      postId: data.postId || null,
      reporterId: session.user.id,
      reason: data.reason.trim(),
      status: 'OPEN',
    },
  })

  revalidatePath(`/courses/${data.courseId}/discuss`)
  publishRealtimeEvent('forum', { courseId: data.courseId, threadId: data.threadId })

  return { success: true }
}

export async function resolveForumReportAction(
  reportId: string,
  resolution: 'DISMISS' | 'DELETE_CONTENT',
  courseId: string
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'MODERATOR') {
    throw new Error('Only Teachers/Moderators can resolve reports.')
  }

  const report = await prisma.forumReport.findUnique({
    where: { id: reportId },
    include: { post: { select: { id: true, threadId: true } } },
  })

  if (!report) {
    return { success: true }
  }

  if (resolution === 'DELETE_CONTENT') {
    if (report.postId) {
      await prisma.forumPost.delete({ where: { id: report.postId } })
    } else if (report.threadId) {
      await prisma.forumThread.delete({ where: { id: report.threadId } })
    }
  } else {
    await prisma.forumReport.update({
      where: { id: reportId },
      data: { status: 'DISMISSED' },
    })
  }

  const targetThreadId = report.post?.threadId || report.threadId || undefined
  revalidatePath(`/courses/${courseId}/discuss`)
  if (targetThreadId) {
    revalidatePath(`/courses/${courseId}/discuss/${targetThreadId}`)
  }
  revalidatePath('/dashboard')
  publishRealtimeEvent('forum', { courseId, threadId: targetThreadId })

  return { success: true }
}

export async function askAiInThreadAction(
  threadId: string,
  questionPrompt: string,
  courseId: string
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Please sign in to trigger AI help.')
  }

  const llm = getLLMProvider()
  const passages = await hybridRetrieve({ query: questionPrompt, courseId, topK: 3 })

  const contextStr = passages.map((p) => `${p.citation}: ${p.content}`).join('\n\n')

  const systemPrompt = `You are TIET-GPT answering a student doubt in the course discussion forum.
Ground your answer ONLY in the provided course material. Provide concise bullet points and cite the exact slide numbers or past papers.`

  const answer = await llm.generateText(
    `Context:\n${contextStr}\n\nStudent Doubt:\n${questionPrompt}`,
    { systemPrompt }
  )

  const citations = passages.map((p) => ({ title: p.title, citation: p.citation }))

  const aiPost = await prisma.forumPost.create({
    data: {
      threadId,
      authorId: session.user.id,
      content: answer,
      isAiGenerated: true,
      citations,
    },
  })

  revalidatePath(`/courses/${courseId}/discuss`)
  revalidatePath(`/courses/${courseId}/discuss/${threadId}`)
  publishRealtimeEvent('forum', { courseId, threadId })
  return { postId: aiPost.id }
}
