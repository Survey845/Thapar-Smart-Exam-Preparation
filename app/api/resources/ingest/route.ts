import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { EvalType, QuestionType, Difficulty } from '@prisma/client'

export const maxDuration = 60

const VALID_EVAL_TYPES = new Set<string>(['MST', 'EST', 'QUIZ', 'SESSIONAL', 'LAB_EVAL', 'VIVA', 'ASSIGNMENT'])
const VALID_Q_TYPES = new Set<string>(['MCQ', 'SHORT', 'LONG', 'NUMERICAL', 'CODING'])
const VALID_DIFFICULTIES = new Set<string>(['EASY', 'MEDIUM', 'HARD'])

async function callGemini(parts: any[], generationConfig: Record<string, any>) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const primary = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.8-flash,gemini-3.5-flash-lite')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  const models = Array.from(new Set([primary, ...fallbacks]))

  let lastErr: Error | null = null
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig,
        }),
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      if (res.status === 503 || res.status === 429 || res.status === 404) {
        lastErr = new Error(`Gemini ${model} (${res.status}): ${errText}`)
        continue
      }
      throw new Error(`Gemini API error (${res.status}): ${errText}`)
    }

    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  }

  throw lastErr || new Error('All Gemini models failed')
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await req.json()
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: { course: true, _count: { select: { questions: true } } },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!doc.fileUrl.startsWith('http') || !doc.fileUrl.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ skipped: true, reason: 'Only public PDF resources are auto-ingested' })
    }

    const isSyllabus = doc.type === 'SYLLABUS'
    const isExamPaper =
      doc.type === 'PYQ' ||
      doc.type === 'SESSIONAL' ||
      doc.type === 'QUIZ' ||
      Boolean(doc.evalType && ['MST', 'EST', 'QUIZ', 'SESSIONAL'].includes(doc.evalType))

    if (!isSyllabus && !isExamPaper) {
      return NextResponse.json({ skipped: true, reason: 'Document type does not require extraction' })
    }

    // Mark as PARSING while extracting
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'PARSING' },
    })

    try {
      const pdfRes = await fetch(doc.fileUrl)
      if (!pdfRes.ok) {
        throw new Error(`Failed to fetch PDF (HTTP ${pdfRes.status})`)
      }
      const buf = Buffer.from(await pdfRes.arrayBuffer())
      if (buf.byteLength > 15 * 1024 * 1024) {
        throw new Error('PDF exceeds 15MB extraction limit')
      }
      const base64 = buf.toString('base64')

      if (isSyllabus) {
        const paragraph = await callGemini(
          [
            { inlineData: { mimeType: 'application/pdf', data: base64 } },
            {
              text: `Write one complete, concise Course Overview paragraph (3-4 sentences, plain text, no bullet points or headings) summarizing the syllabus, core topics, and learning objectives of ${doc.course.code} (${doc.course.name}) based strictly on the attached syllabus PDF.`,
            },
          ],
          { temperature: 0.2, maxOutputTokens: 1024 }
        )

        if (paragraph) {
          await prisma.syllabusUnit.upsert({
            where: { courseId_unitNumber: { courseId: doc.courseId, unitNumber: 0 } },
            update: { title: 'Course Overview', description: paragraph },
            create: {
              courseId: doc.courseId,
              unitNumber: 0,
              title: 'Course Overview',
              description: paragraph,
            },
          })
        }

        await prisma.document.update({
          where: { id: doc.id },
          data: { status: 'APPROVED' },
        })

        revalidatePath(`/courses/${doc.courseId}`)
        revalidatePath(`/courses/${doc.courseId}/resources`)

        return NextResponse.json({ success: true, mode: 'syllabus', overviewUpdated: Boolean(paragraph) })
      }

      // Exam / PYQ / Quiz / Sessional question extraction
      if (doc._count.questions > 0) {
        await prisma.document.update({ where: { id: doc.id }, data: { status: 'APPROVED' } })
        return NextResponse.json({ success: true, mode: 'questions', inserted: 0, skipped: true })
      }

      const defaultEvalType: EvalType =
        (doc.evalType as EvalType) || (doc.type === 'QUIZ' ? 'QUIZ' : doc.type === 'SESSIONAL' ? 'SESSIONAL' : 'EST')
      const defaultYear = doc.year || new Date().getFullYear()

      const responseSchema = {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            questionNumber: { type: 'STRING' },
            text: { type: 'STRING' },
            marks: { type: 'NUMBER' },
            evalType: { type: 'STRING', enum: ['MST', 'EST', 'QUIZ', 'SESSIONAL'] },
            year: { type: 'INTEGER' },
            session: { type: 'STRING' },
            type: { type: 'STRING', enum: ['SHORT', 'LONG', 'NUMERICAL', 'MCQ', 'CODING'] },
            difficulty: { type: 'STRING', enum: ['EASY', 'MEDIUM', 'HARD'] },
            topicTags: { type: 'ARRAY', items: { type: 'STRING' } },
            solution: { type: 'STRING' },
          },
          required: ['questionNumber', 'text', 'marks', 'evalType', 'year', 'type', 'difficulty', 'topicTags', 'solution'],
        },
      }

      const raw = await callGemini(
        [
          { inlineData: { mimeType: 'application/pdf', data: base64 } },
          {
            text: `You are an expert TIET exam paper digitizer for ${doc.course.code} (${doc.course.name}). Document title: "${doc.title}".
Extract ALL real exam questions verbatim from the attached PDF.
Rules:
- Extract each sub-part (e.g. Q1(a), Q1(b)) as its own item if it has its own marks.
- Do NOT invent questions not in the PDF. If none, return [].
- Use marks as printed on the paper (default 5 if not printed).
- Keep topicTags concise (1-3 topic names per question).
- Keep each solution concise and exam-ready (3-5 crisp bullet points, under 120 words).`,
          },
        ],
        { temperature: 0.1, responseMimeType: 'application/json', responseSchema }
      )

      const parsed = JSON.parse(raw || '[]')
      let inserted = 0

      if (Array.isArray(parsed)) {
        for (const q of parsed) {
          if (!q?.text || String(q.text).trim().length < 10) continue
          const evalType = (q.evalType && VALID_EVAL_TYPES.has(String(q.evalType).toUpperCase())
            ? String(q.evalType).toUpperCase()
            : defaultEvalType) as EvalType
          const qType = (q.type && VALID_Q_TYPES.has(String(q.type).toUpperCase())
            ? String(q.type).toUpperCase()
            : 'SHORT') as QuestionType
          const difficulty = (q.difficulty && VALID_DIFFICULTIES.has(String(q.difficulty).toUpperCase())
            ? String(q.difficulty).toUpperCase()
            : 'MEDIUM') as Difficulty
          const year = typeof q.year === 'number' && q.year >= 2010 && q.year <= 2030 ? q.year : defaultYear
          const marks = typeof q.marks === 'number' && q.marks > 0 ? q.marks : 5
          const tags =
            Array.isArray(q.topicTags) && q.topicTags.length > 0
              ? q.topicTags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4)
              : [doc.course.name]

          await prisma.question.create({
            data: {
              courseId: doc.courseId,
              sourceDocId: doc.id,
              evalType,
              year,
              session: q.session || null,
              marks,
              type: qType,
              difficulty,
              text: String(q.text).trim(),
              questionNumber: q.questionNumber ? String(q.questionNumber).trim() : null,
              topicTags: tags,
              isApproved: true,
              confidence: 0.95,
              ...(q.solution?.trim()
                ? {
                    solutions: {
                      create: {
                        authorType: 'AI',
                        content: String(q.solution).trim(),
                        isVerified: true,
                        verifiedBy: 'TIET - AI Auto Ingest',
                      },
                    },
                  }
                : {}),
            },
          })
          inserted++
        }
      }

      await prisma.document.update({
        where: { id: doc.id },
        data: { status: 'APPROVED' },
      })

      revalidatePath(`/courses/${doc.courseId}/resources`)
      revalidatePath(`/courses/${doc.courseId}/questions`)
      revalidatePath(`/courses/${doc.courseId}/practice`)
      revalidatePath(`/courses/${doc.courseId}/quiz`)
      revalidatePath(`/courses/${doc.courseId}/weightage`)

      return NextResponse.json({ success: true, mode: 'questions', inserted })
    } catch (innerErr) {
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: 'APPROVED' },
      })
      throw innerErr
    }
  } catch (err) {
    console.error('Resource ingest error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ingestion failed' },
      { status: 500 }
    )
  }
}

