'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Upload, Loader2, X, FileUp, CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { addCourseResourceAction } from './actions'
import { DocType, EvalType } from '@prisma/client'

interface AddResourceModalProps {
  courseId: string
}

export function AddResourceModal({ courseId }: AddResourceModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocType>('SLIDES')
  const [evalType, setEvalType] = useState<EvalType | ''>('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file')
  const [fileUrl, setFileUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // Auto-populate title if empty
      if (!title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        setTitle(cleanName)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUploading(true)
    setError(null)

    try {
      if (!title.trim()) throw new Error('Please enter a resource title.')

      let finalFileUrl = fileUrl

      // If user selected a local file, upload it via the upload API
      if (uploadMode === 'file') {
        if (!selectedFile) {
          throw new Error('Please select a file to upload.')
        }

        const formData = new FormData()
        formData.append('file', selectedFile)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'File upload failed.')
        }

        finalFileUrl = data.fileUrl
      } else {
        if (!fileUrl.trim()) {
          throw new Error('Please enter a file link.')
        }
      }

      const created = await addCourseResourceAction({
        courseId,
        title,
        type,
        evalType: evalType ? (evalType as EvalType) : undefined,
        year: parseInt(year) || new Date().getFullYear(),
        fileUrl: finalFileUrl,
      })

      // Auto-ingest Syllabus PDFs (updates Course Overview) and Exam/PYQ/Quiz PDFs (populates Question Bank)
      const shouldAutoIngest =
        finalFileUrl.toLowerCase().endsWith('.pdf') &&
        (type === 'SYLLABUS' || type === 'PYQ' || type === 'SESSIONAL' || type === 'QUIZ')

      if (created?.documentId && shouldAutoIngest) {
        fetch('/api/resources/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: created.documentId }),
        })
          .then(() => router.refresh())
          .catch((err) => console.error('Background resource ingest error:', err))
      }

      setOpen(false)
      setTitle('')
      setSelectedFile(null)
      setFileUrl('')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish resource')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="brand-gradient text-white text-xs h-9 font-medium shadow-xs"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Add Resource
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md border-border/80 shadow-2xl relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Upload Course Resource</CardTitle>
              <CardDescription className="text-xs">
                Upload lecture slides, syllabus documents, or past exam question papers.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {error && (
                <div className="mb-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                {/* ── Mode Selector: Local File vs External URL ── */}
                <div className="grid grid-cols-2 p-1 bg-secondary/50 rounded-lg text-center text-xs">
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`py-1.5 rounded-md font-medium transition-all ${
                      uploadMode === 'file'
                        ? 'bg-background shadow-xs text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('link')}
                    className={`py-1.5 rounded-md font-medium transition-all ${
                      uploadMode === 'link'
                        ? 'bg-background shadow-xs text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Google Drive / URL
                  </button>
                </div>

                {/* ── File Picker Drop Area ── */}
                {uploadMode === 'file' ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-secondary/20 transition-all rounded-xl p-4 text-center space-y-1.5"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2 text-primary font-medium">
                        <FileText className="w-5 h-5 text-emerald-500" />
                        <span className="truncate max-w-[240px] text-foreground">{selectedFile.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    ) : (
                      <>
                        <FileUp className="w-6 h-6 mx-auto text-muted-foreground" />
                        <div className="font-semibold text-foreground">Click to select PDF or Slides</div>
                        <p className="text-[10px] text-muted-foreground">Supports PDF, PPTX, DOCX (Up to 25MB)</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="resUrl">File URL / Download Link</Label>
                    <Input
                      id="resUrl"
                      placeholder="https://drive.google.com/file/d/..."
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      required={uploadMode === 'link'}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                )}

                {/* ── Resource Title ── */}
                <div className="space-y-1">
                  <Label htmlFor="resTitle">Resource Title</Label>
                  <Input
                    id="resTitle"
                    placeholder="e.g. Course Syllabus, Unit 3 Slides, or MST 2025 Paper"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </div>

                {/* ── Type Selector ── */}
                <div className={type === 'PYQ' || type === 'SESSIONAL' ? 'grid grid-cols-2 gap-3' : 'space-y-1'}>
                  <div className="space-y-1">
                    <Label htmlFor="resType">Document Type</Label>
                    <select
                      id="resType"
                      value={type}
                      onChange={(e) => setType(e.target.value as DocType)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <option value="SLIDES">Lecture Slides</option>
                      <option value="PYQ">Past Question Paper</option>
                      <option value="SYLLABUS">Syllabus</option>
                      <option value="SOLUTION">Faculty Solution</option>
                      <option value="QUIZ">Quiz Questions</option>
                      <option value="SESSIONAL">Sessional Paper</option>
                    </select>
                  </div>

                  {(type === 'PYQ' || type === 'SESSIONAL') && (
                    <div className="space-y-1">
                      <Label htmlFor="resEval">Exam Type</Label>
                      <select
                        id="resEval"
                        value={evalType}
                        onChange={(e) => setEvalType(e.target.value as EvalType)}
                        className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <option value="MST">MST (Mid-Sem)</option>
                        <option value="EST">EST (End-Sem)</option>
                        <option value="SESSIONAL">Sessional</option>
                        <option value="QUIZ">Quiz</option>
                        <option value="LAB_EVAL">Lab Eval</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                    className="h-8 text-xs"
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={uploading}
                    size="sm"
                    className="brand-gradient text-white h-8 text-xs px-4"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Publish Resource'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
