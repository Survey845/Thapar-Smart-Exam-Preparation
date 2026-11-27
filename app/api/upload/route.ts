import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { uploadToR2 } from '@/lib/storage/r2'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'MODERATOR') {
      return NextResponse.json({ error: 'Unauthorized: Teacher or Moderator role required.' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
    }

    // Limit size to 25MB
    const maxBytes = 25 * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'File size exceeds 25MB limit.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // If R2 credentials are configured, upload to Cloudflare R2
    if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT) {
      try {
        const { key, publicUrl } = await uploadToR2(buffer, file.name, file.type)
        return NextResponse.json({
          success: true,
          fileUrl: publicUrl,
          key,
          fileName: file.name,
          fileSize: file.size,
          storage: 'r2',
        })
      } catch (r2Error) {
        console.error('Cloudflare R2 upload error, falling back to local:', r2Error)
        // Fall back to local storage if R2 encounters an unexpected network/credential issue
      }
    }

    // Local Storage fallback
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadDir, { recursive: true })

    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const uniqueName = `${Date.now()}-${originalName}`
    const filePath = path.join(uploadDir, uniqueName)

    await fs.writeFile(filePath, buffer)
    const fileUrl = `/uploads/${uniqueName}`

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      storage: 'local',
    })
  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json({ error: 'File upload failed on server.' }, { status: 500 })
  }
}
