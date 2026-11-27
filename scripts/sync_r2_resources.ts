import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { PrismaClient, DocType, EvalType } from '@prisma/client'

const prisma = new PrismaClient()

const endpoint = process.env.R2_ENDPOINT || ''
const accessKeyId = process.env.R2_ACCESS_KEY_ID || ''
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ''
const bucketName = process.env.R2_BUCKET_NAME || 'thapar-university-resources'
const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

const r2Client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
})

// Helper to determine DocType, EvalType, Year, Title
function parseResourceMeta(key: string): {
  courseCode: string | null
  courseNameHint: string | null
  title: string
  type: DocType
  evalType?: EvalType
  year?: number
  session?: string
} {
  const parts = key.split('/')
  const fileNameWithExt = parts[parts.length - 1]
  const fileName = fileNameWithExt.replace(/\.[^/.]+$/, '')

  let courseCode: string | null = null
  let courseNameHint: string | null = null

  // Check key patterns
  if (key.includes('UCS503')) {
    courseCode = 'UCS503'
  } else if (key.includes('UCB009') || key.toLowerCase().includes('chemistry')) {
    courseCode = 'UCH101' // In DB, Chemistry is UCH101 or UCB009
    courseNameHint = 'Applied Chemistry'
  } else if (key.toLowerCase().includes('mathematics_2') || key.toLowerCase().includes('mathematics 2') || key.toLowerCase().includes('maths')) {
    courseCode = 'UMA008' // Mathematics
    courseNameHint = 'Mathematics II'
  } else if (key.toLowerCase().includes('professional communication') || key.includes('UHU003')) {
    courseCode = 'UHU003'
    courseNameHint = 'Professional Communication'
  }

  // Type categorization
  let type: DocType = DocType.SLIDES
  let evalType: EvalType | undefined = undefined

  const lowerKey = key.toLowerCase()

  if (lowerKey.includes('pyqs') || lowerKey.includes('mst') || lowerKey.includes('est')) {
    type = DocType.PYQ
    if (lowerKey.includes('mst')) evalType = EvalType.MST
    else if (lowerKey.includes('est')) evalType = EvalType.EST
  } else if (lowerKey.includes('quiz')) {
    type = DocType.QUIZ
    evalType = EvalType.QUIZ
  } else if (lowerKey.includes('assignment') || lowerKey.includes('tutorial') || lowerKey.includes('sessional')) {
    type = DocType.SESSIONAL
    evalType = EvalType.SESSIONAL
  } else if (lowerKey.includes('slides') || lowerKey.includes('lecture')) {
    type = DocType.SLIDES
  } else if (lowerKey.includes('syllabus')) {
    type = DocType.SYLLABUS
  } else if (lowerKey.includes('solution')) {
    type = DocType.SOLUTION
  }

  // Extract year if available
  const yearMatch = fileName.match(/20\d{2}/)
  const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear()

  // Clean title
  const cleanTitle = fileName
    .replace(/^UCS503_/i, '')
    .replace(/^UHU003_/i, '')
    .replace(/_/g, ' ')
    .trim()

  return {
    courseCode,
    courseNameHint,
    title: cleanTitle || fileName,
    type,
    evalType,
    year,
    session: lowerKey.includes('dec') || lowerKey.includes('sep') || lowerKey.includes('oct') ? 'Odd' : 'Even',
  }
}

async function main() {
  console.log('--- Starting Cloudflare R2 Resource Ingestion ---')

  // 1. Fetch moderator user to assign as uploader
  const moderator = await prisma.user.findFirst({
    where: { role: 'MODERATOR' },
  })

  if (!moderator) {
    throw new Error('No teacher/moderator found in database to attribute uploaded resources.')
  }

  console.log(`Using moderator: ${moderator.name} (${moderator.email})`)

  // 2. Fetch existing courses
  const existingCourses = await prisma.course.findMany()
  const courseMap = new Map(existingCourses.map((c) => [c.code, c]))

  // Ensure UHU003 and UCB009 exist if needed
  if (!courseMap.has('UHU003')) {
    const pc = await prisma.course.create({
      data: {
        code: 'UHU003',
        name: 'Professional Communication',
        dept: 'Humanities & Social Sciences',
        semester: 1,
      },
    })
    courseMap.set('UHU003', pc)
    console.log('Created course: UHU003 - Professional Communication')
  }

  if (!courseMap.has('UCB009') && !courseMap.has('UCH101')) {
    const chem = await prisma.course.create({
      data: {
        code: 'UCB009',
        name: 'Applied Chemistry',
        dept: 'School of Chemistry & Biochemistry',
        semester: 1,
      },
    })
    courseMap.set('UCB009', chem)
    console.log('Created course: UCB009 - Applied Chemistry')
  }

  // 3. List all objects from Cloudflare R2
  console.log(`Querying R2 bucket: ${bucketName}...`)
  let isTruncated = true
  let continuationToken: string | undefined = undefined
  let allObjects: any[] = []

  while (isTruncated) {
    const command: ListObjectsV2Command = new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    })
    const response = await r2Client.send(command)
    if (response.Contents) {
      allObjects.push(...response.Contents)
    }
    isTruncated = response.IsTruncated || false
    continuationToken = response.NextContinuationToken
  }

  console.log(`Total objects found in R2: ${allObjects.length}`)

  let createdCount = 0
  let skippedCount = 0

  for (const obj of allObjects) {
    if (!obj.Key || obj.Key.endsWith('/') || obj.Key.startsWith('test-r2-')) continue

    const meta = parseResourceMeta(obj.Key)
    if (!meta.courseCode) {
      // Default to UCS503 if course not detected
      meta.courseCode = 'UCS503'
    }

    // Match course
    let targetCourse = courseMap.get(meta.courseCode)
    if (!targetCourse && meta.courseCode === 'UCH101') {
      targetCourse = courseMap.get('UCH101') || courseMap.get('UCB009')
    }

    if (!targetCourse) {
      targetCourse = courseMap.get('UCS503')
    }

    if (!targetCourse) {
      skippedCount++
      continue
    }

    const fileUrl = `${publicUrl}/${obj.Key}`

    // Check if document already exists
    const existing = await prisma.document.findFirst({
      where: {
        fileUrl,
      },
    })

    if (existing) {
      skippedCount++
      continue
    }

    await prisma.document.create({
      data: {
        courseId: targetCourse.id,
        uploaderId: moderator.id,
        title: meta.title,
        type: meta.type,
        evalType: meta.evalType,
        year: meta.year,
        session: meta.session,
        fileUrl,
        fileSize: obj.Size || 0,
        status: 'APPROVED',
      },
    })

    createdCount++
  }

  console.log(`\nIngestion Summary:`)
  console.log(`Successfully imported: ${createdCount} documents`)
  console.log(`Skipped (already registered / non-matching): ${skippedCount}`)
}

main()
  .catch((e) => {
    console.error('Ingestion failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

