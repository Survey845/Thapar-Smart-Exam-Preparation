'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

const STORAGE_KEY = 'tiet_course_origin_tab'

const TAB_META: Record<string, { label: string; href: string }> = {
  courses: { label: 'My Courses', href: '/dashboard?tab=courses' },
  catalog: { label: 'Course Catalog', href: '/dashboard?tab=catalog' },
  calendar: { label: 'Academic Calendar', href: '/dashboard?tab=calendar' },
  doubts: { label: 'Student Doubts', href: '/dashboard?tab=doubts' },
}

interface CourseBreadcrumbProps {
  courseCode: string
}

export function CourseBreadcrumb({ courseCode }: CourseBreadcrumbProps) {
  const [originKey, setOriginKey] = useState<string>('courses')

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const from = params.get('from')
      if (from && TAB_META[from]) {
        sessionStorage.setItem(STORAGE_KEY, from)
        setOriginKey(from)
      } else {
        const stored = sessionStorage.getItem(STORAGE_KEY)
        if (stored && TAB_META[stored]) {
          setOriginKey(stored)
        }
      }
    } catch {
      // Fallback to My Courses
    }
  }, [])

  const origin = TAB_META[originKey] || TAB_META.courses

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-xs leading-none text-muted-foreground mb-3"
    >
      <Link
        href={origin.href}
        className="inline-flex items-center gap-1 leading-none hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
        <span className="leading-none">{origin.label}</span>
      </Link>
      <span className="inline-flex items-center leading-none text-muted-foreground/60">/</span>
      <span className="inline-flex items-center leading-none font-mono font-medium text-foreground">
        {courseCode}
      </span>
    </nav>
  )
}

