import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const FALLBACK_BATCHES = [
  { id: 'batch_coe_3_3c72', branch: 'COE', year: 3, group: '3C72' },
  { id: 'batch_coe_2_2c12', branch: 'COE', year: 2, group: '2C12' },
  { id: 'batch_cse_3_3c11', branch: 'CSE', year: 3, group: '3C11' },
  { id: 'batch_enc_2_2e5', branch: 'ENC', year: 2, group: '2E5' },
]

export async function GET() {
  try {
    const batches = await prisma.batch.findMany({
      orderBy: [
        { branch: 'asc' },
        { year: 'asc' },
        { group: 'asc' },
      ],
    })

    if (batches && batches.length > 0) {
      return NextResponse.json(batches)
    }

    return NextResponse.json(FALLBACK_BATCHES)
  } catch {
    // Return fallback batches with 200 status so client registration never fails
    return NextResponse.json(FALLBACK_BATCHES)
  }
}
