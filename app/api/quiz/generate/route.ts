import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'

export const maxDuration = 60

export interface GeneratedMcq {
  id: string
  question: string
  options: [string, string, string, string]
  correctIndex: number
  explanation: string
  topic: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const courseId = String(body.courseId || '')
    const requestedCount = Math.min(15, Math.max(3, Number(body.count) || 5))
    const topicFilter = body.topic && body.topic !== 'ALL' ? String(body.topic) : null

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { code: true, name: true },
    })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const questions = await prisma.question.findMany({
      where: {
        courseId,
        isApproved: true,
        ...(topicFilter ? { topicTags: { has: topicFilter } } : {}),
      },
      include: {
        solutions: { take: 1, orderBy: { isVerified: 'desc' }, select: { content: true } },
      },
      take: 30,
    })

    if (questions.length === 0) {
      return NextResponse.json(
        { error: `No past-paper questions available for ${course.code} yet.` },
        { status: 400 }
      )
    }

    // Prioritize uploaded QUIZ questions alongside MST/EST/SESSIONAL PYQs
    const quizQuestions = questions.filter((q) => q.evalType === 'QUIZ')
    const otherQuestions = questions.filter((q) => q.evalType !== 'QUIZ')
    const sampled = [
      ...[...quizQuestions].sort(() => 0.5 - Math.random()),
      ...[...otherQuestions].sort(() => 0.5 - Math.random()),
    ].slice(0, Math.min(15, questions.length))

    const sourceMaterial = sampled
      .map((q, idx) => {
        const sol = q.solutions[0]?.content ? `\nKey Answer: ${q.solutions[0].content.slice(0, 350)}` : ''
        return `[PYQ ${idx + 1} | ${q.evalType} ${q.year} | Topics: ${q.topicTags.join(', ')}]\n${q.text.slice(0, 450)}${sol}`
      })
      .join('\n\n---\n\n')

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })
    }

    const primary = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
    const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.8-flash,gemini-3.5-flash-lite')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
    const models = Array.from(new Set([primary, ...fallbacks]))

    const prompt = `You are a TIET (Thapar Institute of Engineering & Technology) exam question author for ${course.code} (${course.name}).

Using the real past exam questions below as your source material, create exactly ${requestedCount} high-quality, exam-grade 4-option Multiple Choice Questions (MCQs).

Source Past Exam Questions:
${sourceMaterial}

Rules:
- Every MCQ must test a real concept, scenario, calculation, or distinction from the source past exam questions above.
- Each MCQ MUST have exactly 4 distinct, plausible options (do NOT prefix options with "A.", "B.", etc. — just the option text).
- Avoid trivial or obviously absurd distractors.
- Vary correctIndex across 0, 1, 2, 3 so the answers are well-distributed.
- Keep each explanation concise (1-2 crisp sentences).
- Use LaTeX ($...$) for any math expressions.`

    const responseSchema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            minItems: 4,
            maxItems: 4,
          },
          correctIndex: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
          topic: { type: 'STRING' },
          difficulty: { type: 'STRING', enum: ['EASY', 'MEDIUM', 'HARD'] },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'topic', 'difficulty'],
      },
    }

    let lastErr: Error | null = null
    for (const model of models) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        if (res.status === 503 || res.status === 429 || res.status === 404) {
          lastErr = new Error(`Gemini ${model} (${res.status}): ${errText}`)
          continue
        }
        throw new Error(`Gemini API error (${res.status}): ${errText}`)
      }

      const data = await res.json()
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
      const parsed = JSON.parse(raw)

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Failed to generate MCQs from course material.')
      }

      const mcqs: GeneratedMcq[] = parsed
        .filter((item: any) => item?.question && Array.isArray(item.options) && item.options.length === 4)
        .slice(0, requestedCount)
        .map((item: any, idx: number) => ({
          id: `mcq-${Date.now()}-${idx}`,
          question: String(item.question).trim(),
          options: [
            String(item.options[0]).trim(),
            String(item.options[1]).trim(),
            String(item.options[2]).trim(),
            String(item.options[3]).trim(),
          ],
          correctIndex:
            typeof item.correctIndex === 'number' && item.correctIndex >= 0 && item.correctIndex <= 3
              ? item.correctIndex
              : 0,
          explanation: String(item.explanation || '').trim(),
          topic: String(item.topic || course.name).trim(),
          difficulty:
            item.difficulty === 'EASY' || item.difficulty === 'HARD' ? item.difficulty : 'MEDIUM',
        }))

      return NextResponse.json({ mcqs })
    }

    throw lastErr || new Error('All Gemini models failed')
  } catch (err) {
    console.error('Quiz generation error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate quiz' },
      { status: 500 }
    )
  }
}

