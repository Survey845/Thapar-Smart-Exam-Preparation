'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MathRenderer } from '@/components/math/MathRenderer'
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  BarChart,
  Loader2,
  ListChecks,
} from 'lucide-react'

interface SourceQuestion {
  id: string
  topicTags: string[]
}

interface McqQuestion {
  id: string
  question: string
  options: [string, string, string, string]
  correctIndex: number
  explanation: string
  topic: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
}

interface MockQuizRunnerProps {
  courseId: string
  courseCode: string
  questions: SourceQuestion[]
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

export function MockQuizRunner({
  courseId,
  courseCode,
  questions,
}: MockQuizRunnerProps) {
  const [stage, setStage] = useState<'INTRO' | 'IN_PROGRESS' | 'REPORT'>('INTRO')
  const [questionCount, setQuestionCount] = useState<number>(5)
  const [selectedTopic, setSelectedTopic] = useState<string>('ALL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [quizList, setQuizList] = useState<McqQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number>(10 * 60)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})

  const allTopics = useMemo(() => {
    const set = new Set<string>()
    questions.forEach((q) => q.topicTags.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [questions])

  const durationMinutes = questionCount === 5 ? 8 : questionCount === 10 ? 15 : 22

  // ── Timer Effect ──
  useEffect(() => {
    if (stage !== 'IN_PROGRESS') return
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setStage('REPORT')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [stage])

  async function startQuiz() {
    if (questions.length === 0) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          count: questionCount,
          topic: selectedTopic,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate quiz.')
      }

      setQuizList(data.mcqs || [])
      setCurrentIndex(0)
      setSelectedAnswers({})
      setTimeLeft(durationMinutes * 60)
      setStage('IN_PROGRESS')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate quiz.')
    } finally {
      setLoading(false)
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // ── 1. INTRO / SETUP STAGE ──
  if (stage === 'INTRO') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              {courseCode} Multiple-Choice Quiz
            </CardTitle>
            <CardDescription className="text-xs">
              Timed 4-option MCQ quiz generated directly from real {courseCode} past exam papers, with instant automatic grading and topic diagnostics.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Number of Questions */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Number of Questions
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 15].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuestionCount(num)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                      questionCount === num
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border/60 hover:bg-secondary text-muted-foreground'
                    }`}
                  >
                    {num} MCQs
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Filter */}
            {allTopics.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Topic Focus
                </label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-border/60 bg-background text-foreground"
                >
                  <option value="ALL">All Course Topics ({questions.length} source PYQs)</option>
                  {allTopics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                <div className="text-xs text-muted-foreground">Format</div>
                <div className="text-base font-bold text-foreground">4-Option MCQ</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="text-base font-bold text-foreground">{durationMinutes} Mins</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                <div className="text-xs text-muted-foreground">Source Pool</div>
                <div className="text-base font-bold text-foreground">{questions.length} PYQs</div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {questions.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-border/70 text-center text-xs text-muted-foreground">
                No past-paper questions have been extracted for {courseCode} yet.
              </div>
            ) : (
              <Button
                onClick={startQuiz}
                disabled={loading}
                className="w-full brand-gradient text-white border-0 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating {questionCount} MCQs from Past Papers...
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Start Timed Quiz
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── 3. REPORT / RESULTS STAGE ──
  if (stage === 'REPORT') {
    const total = quizList.length || 1
    let correctCount = 0
    const topicStats: Record<string, { wrong: number; total: number }> = {}

    quizList.forEach((q) => {
      const picked = selectedAnswers[q.id]
      const isRight = picked === q.correctIndex
      if (isRight) correctCount++

      if (!topicStats[q.topic]) topicStats[q.topic] = { wrong: 0, total: 0 }
      topicStats[q.topic].total += 1
      if (!isRight) topicStats[q.topic].wrong += 1
    })

    const scorePct = Math.round((correctCount / total) * 100)
    const weakTopics = Object.entries(topicStats)
      .filter(([, s]) => s.wrong > 0)
      .sort((a, b) => b[1].wrong - a[1].wrong)
      .slice(0, 4)

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        <Card className="border-border/70 p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <Badge className="brand-gradient text-white border-0 text-xs">
              Quiz Result
            </Badge>
            <h3 className="text-3xl font-extrabold tracking-tight">Scorecard & Review</h3>
            <p className="text-xs text-muted-foreground">
              {courseCode} Multiple-Choice Quiz Performance
            </p>
          </div>

          {/* Score Summary */}
          <div className="flex items-center justify-center gap-6 py-4 px-6 rounded-2xl bg-secondary/40 border border-border/60 max-w-sm mx-auto">
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Score
              </div>
              <div className="text-4xl font-black text-primary">
                {correctCount}{' '}
                <span className="text-xl font-normal text-muted-foreground">/ {total}</span>
              </div>
            </div>
            <div className="h-10 w-px bg-border/60" />
            <div>
              <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Accuracy
              </div>
              <div className="text-3xl font-bold text-foreground">{scorePct}%</div>
            </div>
          </div>

          {/* Weak Topics */}
          {weakTopics.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <BarChart className="h-4 w-4 text-destructive" />
                Topics to Review
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {weakTopics.map(([topic, stats]) => (
                  <div
                    key={topic}
                    className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-foreground">{topic}</span>
                    <Badge variant="destructive" className="text-[10px]">
                      {stats.wrong}/{stats.total} missed
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question-by-Question Review */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              Answer Key & Explanations
            </h4>

            <div className="space-y-4">
              {quizList.map((q, idx) => {
                const picked = selectedAnswers[q.id]
                const isRight = picked === q.correctIndex

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-xl border space-y-3 ${
                      isRight
                        ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                        : 'border-destructive/30 bg-destructive/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed">
                        <span className="text-muted-foreground mr-1.5">Q{idx + 1}.</span>
                        <MathRenderer content={q.question} />
                      </div>
                      {isRight ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const isCorrectOpt = optIdx === q.correctIndex
                        const isPickedOpt = optIdx === picked

                        let optClass = 'border-border/50 bg-background/60 text-muted-foreground'
                        if (isCorrectOpt) {
                          optClass =
                            'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
                        } else if (isPickedOpt && !isCorrectOpt) {
                          optClass =
                            'border-destructive/50 bg-destructive/15 text-destructive font-semibold'
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`px-3 py-2 rounded-lg border text-xs flex items-start gap-2 ${optClass}`}
                          >
                            <span className="font-bold shrink-0">{OPTION_LETTERS[optIdx]}.</span>
                            <span>
                              <MathRenderer content={opt} />
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {q.explanation && (
                      <div className="text-xs text-muted-foreground bg-secondary/40 p-2.5 rounded-lg">
                        <strong className="text-foreground">Explanation: </strong>
                        <MathRenderer content={q.explanation} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Button
              onClick={() => setStage('INTRO')}
              className="brand-gradient text-white border-0"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Take Another Quiz
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ── 2. IN_PROGRESS STAGE ──
  const current = quizList[currentIndex]
  if (!current) return null

  const answeredCount = Object.keys(selectedAnswers).length
  const pickedForCurrent = selectedAnswers[current.id]

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Top Status & Timer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-foreground">
            Question {currentIndex + 1} of {quizList.length}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="text-muted-foreground">
            {answeredCount}/{quizList.length} answered
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-1 rounded-md border ${
              timeLeft < 120
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-border/60 bg-secondary/60 text-foreground'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {formatTime(timeLeft)}
          </div>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => setStage('REPORT')}
            className="h-7 text-xs"
          >
            Submit Quiz
          </Button>
        </div>
      </div>

      {/* Question Navigator Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {quizList.map((q, idx) => {
          const isCurrent = idx === currentIndex
          const isAnswered = selectedAnswers[q.id] !== undefined
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                  : isAnswered
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'border-border/60 bg-card text-muted-foreground hover:bg-secondary'
              }`}
            >
              {idx + 1}
            </button>
          )
        })}
      </div>

      {/* Active MCQ Card */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {current.topic}
              </Badge>
              <Badge
                variant={
                  current.difficulty === 'HARD'
                    ? 'destructive'
                    : current.difficulty === 'EASY'
                    ? 'default'
                    : 'outline'
                }
                className="text-xs"
              >
                {current.difficulty}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">Select one option</span>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6 space-y-5">
          <div className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
            <MathRenderer content={current.question} />
          </div>

          {/* 4-Option Multiple Choice Grid */}
          <div className="space-y-2.5">
            {current.options.map((optionText, optIdx) => {
              const isSelected = pickedForCurrent === optIdx
              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() =>
                    setSelectedAnswers((prev) => ({ ...prev, [current.id]: optIdx }))
                  }
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                      : 'border-border/70 bg-background hover:bg-secondary/40 text-foreground/90'
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {OPTION_LETTERS[optIdx]}
                  </span>
                  <span className="text-xs sm:text-sm leading-relaxed pt-0.5">
                    <MathRenderer content={optionText} />
                  </span>
                </button>
              )
            })}
          </div>

          {/* Navigation Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              className="text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Previous
            </Button>

            {currentIndex + 1 < quizList.length ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setCurrentIndex((i) => i + 1)}
                className="brand-gradient text-white border-0 text-xs"
              >
                Next Question
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setStage('REPORT')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Finish & View Score
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
