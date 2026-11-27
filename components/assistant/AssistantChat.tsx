'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MathRenderer } from '@/components/math/MathRenderer'
import { Sparkles, Send, Loader2, BookOpen, HelpCircle, FileText } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{
    id: string
    title: string
    citation: string
    sourceType: string
  }>
}

interface AssistantChatProps {
  courseId: string
  courseCode: string
  courseName?: string
}

export function AssistantChat({ courseId, courseCode, courseName }: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I am **TIET - GPT**, your exam prep assistant for **${courseCode}**${courseName ? ` (${courseName})` : ''}. How can I help you prepare today?`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend(textToSend?: string) {
    const query = textToSend || input
    if (!query.trim() || loading) return

    const newMsgs: Message[] = [...messages, { role: 'user', content: query }]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, message: query }),
      })

      if (!res.ok) {
        throw new Error('Failed to fetch assistant response')
      }

      const data = await res.json()
      setMessages([
        ...newMsgs,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
        },
      ])
    } catch (err) {
      console.error(err)
      setMessages([
        ...newMsgs,
        {
          role: 'assistant',
          content:
            'Sorry, I encountered an error retrieving the course material. Please verify your connection and try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Chat Window ── */}
      <Card className="border-border/70 shadow-sm flex flex-col h-[520px]">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'

            return (
              <div
                key={i}
                className={`flex gap-3 text-xs leading-relaxed ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="h-7 w-7 rounded-lg brand-gradient text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-4 max-w-[85%] sm:max-w-[75%] space-y-2.5 ${
                    isUser
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-muted/40 border border-border/60 text-foreground'
                  }`}
                >
                  <MathRenderer content={msg.content} />
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex gap-3 text-xs items-center text-muted-foreground">
              <div className="h-7 w-7 rounded-lg brand-gradient text-white flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-border/60 bg-card">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask TIET-GPT anything about ${courseCode} exam questions and slides...`}
              disabled={loading}
              className="text-xs h-10"
            />
            <Button type="submit" disabled={loading || !input.trim()} className="h-10 px-4">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
