import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'

export default async function CoursesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard?tab=catalog')
  }

  if (session.user.role === 'MODERATOR') {
    redirect('/dashboard')
  }

  redirect('/dashboard?tab=catalog')
}
