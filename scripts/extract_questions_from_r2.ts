import { prisma } from '../lib/db'
import { EvalType, QuestionType, Difficulty } from '@prisma/client'

interface ExtractedQuestion {
  questionNumber?: string
  text: string
  marks?: number
  evalType?: string
  year?: number
  session?: string
  type?: string
  difficulty?: string
  topicTags?: string[]
  solution?: string
}

const VALID_EVAL_TYPES = new Set<string>(['MST', 'EST', 'QUIZ', 'SESSIONAL', 'LAB_EVAL', 'VIVA', 'ASSIGNMENT'])
const VALID_Q_TYPES = new Set<string>(['MCQ', 'SHORT', 'LONG', 'NUMERICAL', 'CODING'])
const VALID_DIFFICULTIES = new Set<string>(['EASY', 'MEDIUM', 'HARD'])

function inferEvalType(urlAndTitle: string): EvalType {
  const s = urlAndTitle.toUpperCase()
  if (s.includes('EST')) return 'EST'
  if (s.includes('MST')) return 'MST'
  if (s.includes('QUIZ')) return 'QUIZ'
  if (s.includes('TUT') || s.includes('SESSIONAL')) return 'SESSIONAL'
  return 'EST'
}

function inferYear(urlAndTitle: string): number {
  const m4 = urlAndTitle.match(/20(1[5-9]|2[0-9])/)
  if (m4) return parseInt(m4[0], 10)
  const m2 = urlAndTitle.match(/(?:DEC|MAY|JUL|OCT|MST|EST)[_\s-]?(2[0-6])\b/i)
  if (m2) return 2000 + parseInt(m2[1], 10)
  return 2024
}

async function callGeminiWithPdf(
  pdfBase64: string,
  courseCode: string,
  courseName: string,
  docTitle: string,
  defaultEvalType: EvalType,
  defaultYear: number
): Promise<ExtractedQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env')

  const primary = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.6-flash,gemini-3.8-flash,gemini-3.5-flash-lite')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  const models = Array.from(new Set([primary, ...fallbacks]))

  const prompt = `You are an expert TIET (Thapar Institute of Engineering & Technology) exam paper digitizer for ${courseCode} (${courseName}).
Document title: "${docTitle}"

Inspect every page of the attached PDF exam/tutorial paper and extract ALL real exam questions verbatim.

Rules:
- Extract each sub-part (e.g. Q1(a), Q1(b)) as its own item if it has its own marks; otherwise keep the full question together.
- Do NOT invent questions that are not in the PDF.
- If the PDF contains no exam/practice questions, return an empty array [].
- Use marks as printed on the paper (default to 5 if not printed).
- Keep topicTags concise (1-3 clean topic names per question, e.g. "Requirement Engineering", "DFD", "UML Class Diagram", "COCOMO", "Software Testing", "Agile & Scrum").
- Keep each solution concise and exam-ready (3-5 crisp bullet points or key steps, under 120 words).`

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

  let lastError: Error | null = null

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      if (res.status === 503 || res.status === 429 || res.status === 404) {
        console.warn(`  ⚠️  Model ${model} returned ${res.status}, trying fallback...`)
        lastError = new Error(`Gemini ${model} (${res.status}): ${errText}`)
        continue
      }
      throw new Error(`Gemini API error (${res.status}): ${errText}`)
    }

    const data = await res.json()
    const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed as ExtractedQuestion[]
  }

  throw lastError || new Error('All Gemini models failed')
}

async function main() {
  const args = process.argv.slice(2)
  const courseArg = args.find((a) => a.startsWith('--course='))?.split('=')[1]?.toUpperCase()
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1]
  const docLimit = limitArg ? parseInt(limitArg, 10) : Infinity

  const courses = await prisma.course.findMany({
    where: courseArg ? { code: courseArg } : undefined,
    include: {
      documents: {
        include: { _count: { select: { questions: true } } },
        orderBy: { title: 'asc' },
      },
    },
    orderBy: { code: 'asc' },
  })

  if (courses.length === 0) {
    console.log('No matching courses found.')
    return
  }

  let totalInserted = 0

  for (const course of courses) {
    console.log(`\n=== ${course.code}: ${course.name} ===`)

    // Fix any slide PDFs that were mislabeled as PYQ
    const mislabeledSlides = course.documents.filter(
      (d) => d.type === 'PYQ' && /\/slides\//i.test(d.fileUrl)
    )
    if (mislabeledSlides.length > 0) {
      await prisma.document.updateMany({
        where: { id: { in: mislabeledSlides.map((d) => d.id) } },
        data: { type: 'SLIDES' },
      })
      console.log(`  Fixed ${mislabeledSlides.length} mislabeled slide documents -> type: SLIDES`)
    }

    // Select real R2 PDF exam/PYQ/quiz/tutorial papers (exclude slides and seed-data)
    const examDocs = course.documents.filter((d) => {
      if (!d.fileUrl.startsWith('http')) return false
      if (!d.fileUrl.toLowerCase().endsWith('.pdf')) return false
      if (/\/slides\//i.test(d.fileUrl)) return false
      if (d.evalType === 'QUIZ' || d.evalType === 'MST' || d.evalType === 'EST' || d.evalType === 'SESSIONAL') {
        return true
      }
      return /\/pyqs?\/|tutorial|tut\b|mst|est|quiz|sessional|exam|paper/i.test(
        decodeURIComponent(d.fileUrl) + ' ' + d.title
      )
    })

    console.log(`  Found ${examDocs.length} exam/PYQ/tutorial PDFs in R2.`)

    const pendingDocs = examDocs
      .filter((doc) => {
        if (doc._count.questions > 0) {
          console.log(`  ⏭️  Skipping "${doc.title}" (already has ${doc._count.questions} questions)`)
          return false
        }
        return true
      })
      .slice(0, docLimit)

    const CONCURRENCY = 3
    for (let i = 0; i < pendingDocs.length; i += CONCURRENCY) {
      const batch = pendingDocs.slice(i, i + CONCURRENCY)
      await Promise.all(
        batch.map(async (doc) => {
          console.log(`  📄 Fetching "${doc.title}"...`)
          try {
            const pdfRes = await fetch(doc.fileUrl)
            if (!pdfRes.ok) {
              console.warn(`  ❌ HTTP ${pdfRes.status} fetching ${doc.fileUrl}`)
              return
            }
            const buf = Buffer.from(await pdfRes.arrayBuffer())
            if (buf.byteLength > 15 * 1024 * 1024) {
              console.warn(`  ⏭️  Skipping "${doc.title}" (>15MB: ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB)`)
              return
            }

            const defaultEvalType = inferEvalType(doc.title + ' ' + doc.fileUrl)
            const defaultYear = inferYear(doc.title + ' ' + doc.fileUrl)

            console.log(`  🤖 Extracting "${doc.title}" (${(buf.byteLength / 1024).toFixed(0)} KB)...`)
            const extracted = await callGeminiWithPdf(
              buf.toString('base64'),
              course.code,
              course.name,
              doc.title,
              defaultEvalType,
              defaultYear
            )

            let insertedForDoc = 0
            for (const q of extracted) {
              if (!q.text || q.text.trim().length < 10) continue

              const evalType = (q.evalType && VALID_EVAL_TYPES.has(q.evalType.toUpperCase())
                ? q.evalType.toUpperCase()
                : defaultEvalType) as EvalType
              const qType = (q.type && VALID_Q_TYPES.has(q.type.toUpperCase())
                ? q.type.toUpperCase()
                : 'SHORT') as QuestionType
              const difficulty = (q.difficulty && VALID_DIFFICULTIES.has(q.difficulty.toUpperCase())
                ? q.difficulty.toUpperCase()
                : 'MEDIUM') as Difficulty
              const year = typeof q.year === 'number' && q.year >= 2010 && q.year <= 2030 ? q.year : defaultYear
              const marks = typeof q.marks === 'number' && q.marks > 0 ? q.marks : 5
              const tags = Array.isArray(q.topicTags) && q.topicTags.length > 0
                ? q.topicTags.map((t) => String(t).trim()).filter(Boolean).slice(0, 4)
                : [course.name]

              await prisma.question.create({
                data: {
                  courseId: course.id,
                  sourceDocId: doc.id,
                  evalType,
                  year,
                  session: q.session || null,
                  marks,
                  type: qType,
                  difficulty,
                  text: q.text.trim(),
                  questionNumber: q.questionNumber?.trim() || null,
                  topicTags: tags,
                  isApproved: true,
                  confidence: 0.95,
                  ...(q.solution?.trim()
                    ? {
                        solutions: {
                          create: {
                            authorType: 'AI',
                            content: q.solution.trim(),
                            isVerified: true,
                            verifiedBy: 'TIET - AI PDF Extractor',
                          },
                        },
                      }
                    : {}),
                },
              })
              insertedForDoc++
              totalInserted++
            }

            console.log(`  ✅ Inserted ${insertedForDoc} real questions from "${doc.title}"`)
          } catch (err) {
            console.error(`  ❌ Failed "${doc.title}":`, err instanceof Error ? err.message : err)
          }
        })
      )
    }
  }

  console.log(`\n🎉 Done! Total real questions extracted and inserted: ${totalInserted}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

