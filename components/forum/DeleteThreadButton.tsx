'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { moderateThreadAction } from '@/app/courses/[id]/discuss/actions'

interface DeleteThreadButtonProps {
  threadId: string
  courseId: string
}

export function DeleteThreadButton({ threadId, courseId }: DeleteThreadButtonProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await moderateThreadAction(threadId, 'DELETE', courseId)
      router.push(`/courses/${courseId}/discuss`)
      router.refresh()
    } catch (err) {
      console.error('Failed to delete thread:', err)
      setDeleting(false)
    }
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={deleting}
      onClick={handleDelete}
      className="text-xs h-7"
    >
      {deleting ? (
        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5 mr-1" />
      )}
      Delete
    </Button>
  )
}

