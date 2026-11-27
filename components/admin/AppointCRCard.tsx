'use client'

import { useState } from 'react'
import { assignUserRoleAction } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface AppointCRCardProps {
  onAppointed?: (cr: {
    id: string
    name: string
    email: string
    batch: { branch: string; year: number; group: string } | null
  }) => void
}

export function AppointCRCard({ onAppointed }: AppointCRCardProps = {}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleMakeCR(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      const cleanEmail = email.toLowerCase().trim()
      if (!cleanEmail.endsWith('@thapar.edu')) {
        throw new Error('Please enter a valid @thapar.edu email address.')
      }

      const result = await assignUserRoleAction(cleanEmail, 'CR')
      if (!result.success) {
        setError(result.error || 'Failed to appoint CR')
        return
      }

      setMessage(`Appointed ${cleanEmail} as Class Representative.`)
      setEmail('')
      if (result.user && onAppointed) {
        onAppointed(result.user)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to appoint CR'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          <span>Appoint Class Representative</span>
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enter an enrolled student&apos;s institutional email to designate them as CR for their sub-group.
        </p>
      </div>

      {message && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleMakeCR} className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="crEmail" className="sr-only">Student Email</Label>
          <Input
            id="crEmail"
            type="email"
            placeholder="rollnumber@thapar.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-9 text-xs"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="brand-gradient text-white text-xs h-9 px-4 font-semibold shadow-xs shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : (
            'Make CR'
          )}
        </Button>
      </form>
    </div>
  )
}
