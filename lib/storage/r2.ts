import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const endpoint = process.env.R2_ENDPOINT || ''
const accessKeyId = process.env.R2_ACCESS_KEY_ID || ''
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ''
const bucketName = process.env.R2_BUCKET_NAME || 'thapar-university-resources'
const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

// Initialize S3-compatible client for Cloudflare R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
})

/**
 * Uploads a file buffer directly to Cloudflare R2 and returns its public URL
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<{ key: string; publicUrl: string }> {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `resources/${Date.now()}-${cleanName}`

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType || 'application/octet-stream',
  })

  await r2Client.send(command)

  // Construct the public URL
  const filePublicUrl = publicUrl
    ? `${publicUrl}/${key}`
    : `${endpoint}/${bucketName}/${key}`

  return {
    key,
    publicUrl: filePublicUrl,
  }
}

