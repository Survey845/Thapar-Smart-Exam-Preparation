'use client'

import React from 'react'

interface MathRendererProps {
  content: string
  className?: string
}

/**
 * Clean renderer for text containing full Markdown formatting (headings, nested lists,
 * numbered lists, tables, blockquotes, bold/italic, code blocks) and LaTeX math notation.
 */
export function MathRenderer({ content, className = '' }: MathRendererProps) {
  if (!content) return null

  // Split by fenced code blocks and display math blocks ($$...$$) first
  const blockRegex = /(```[a-zA-Z0-9_-]*\n[\s\S]*?```|\$\$[\s\S]*?\$\$)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = blockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        renderMarkdownLines(content.substring(lastIndex, match.index), `md-${lastIndex}`)
      )
    }

    const token = match[0]
    if (token.startsWith('```')) {
      const firstNewline = token.indexOf('\n')
      const language = token.slice(3, firstNewline).trim() || 'text'
      const code = token.slice(firstNewline + 1, -3)
      parts.push(
        <div key={`code-${match.index}`} className="my-2.5 rounded-lg overflow-hidden border border-border/70">
          <div className="bg-muted px-3 py-1 text-[11px] font-mono text-muted-foreground border-b border-border/40 uppercase">
            {language}
          </div>
          <pre className="p-3 text-xs bg-muted/40 overflow-x-auto font-mono text-foreground">
            <code>{code}</code>
          </pre>
        </div>
      )
    } else if (token.startsWith('$$') && token.endsWith('$$')) {
      const formula = token.slice(2, -2).trim()
      parts.push(
        <div
          key={`math-${match.index}`}
          className="my-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50 font-serif italic text-center text-sm text-primary overflow-x-auto"
          title={formula}
        >
          {cleanLatexSymbols(formula)}
        </div>
      )
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < content.length) {
    parts.push(renderMarkdownLines(content.substring(lastIndex), `md-${lastIndex}`))
  }

  return <div className={`leading-relaxed space-y-1.5 ${className}`}>{parts}</div>
}

function renderMarkdownLines(textChunk: string, keyPrefix: string): React.ReactNode {
  const lines = textChunk.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    // Markdown table detection
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      /^\|?[\s:-]+\|/.test(lines[i + 1].trim())
    ) {
      const headerCells = trimmed
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim())
      i += 2 // skip header + separator
      const bodyRows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        bodyRows.push(
          lines[i]
            .trim()
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((c) => c.trim())
        )
        i++
      }

      nodes.push(
        <div key={`${keyPrefix}-tbl-${i}`} className="my-2 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted/60">
              <tr>
                {headerCells.map((h, ci) => (
                  <th key={ci} className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/50">
                    {formatInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-b border-border/40 last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-foreground/90">
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      nodes.push(<hr key={`${keyPrefix}-hr-${i}`} className="my-2 border-border/60" />)
      i++
      continue
    }

    // Headings (# to ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingText = headingMatch[2]
      const cls =
        level === 1
          ? 'font-bold text-base text-foreground pt-2'
          : level === 2
          ? 'font-bold text-sm text-foreground pt-2'
          : 'font-semibold text-sm text-foreground pt-1.5'
      nodes.push(
        <h4 key={`${keyPrefix}-h-${i}`} className={cls}>
          {formatInline(headingText)}
        </h4>
      )
      i++
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      nodes.push(
        <blockquote
          key={`${keyPrefix}-bq-${i}`}
          className="border-l-2 border-primary/50 pl-3 py-0.5 text-sm italic text-muted-foreground"
        >
          {formatInline(trimmed.slice(2))}
        </blockquote>
      )
      i++
      continue
    }

    // Unordered list item (supports indented bullets)
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/)
    if (bulletMatch) {
      const indentLevel = Math.min(3, Math.floor(bulletMatch[1].length / 2))
      nodes.push(
        <div
          key={`${keyPrefix}-ul-${i}`}
          className="flex items-start gap-2 text-sm text-foreground/90"
          style={{ paddingLeft: `${indentLevel * 14 + 6}px` }}
        >
          <span className="text-primary font-bold text-xs mt-1 shrink-0">•</span>
          <span className="min-w-0 flex-1">{formatInline(bulletMatch[2])}</span>
        </div>
      )
      i++
      continue
    }

    // Ordered list item (1. 2. etc.)
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/)
    if (orderedMatch) {
      const indentLevel = Math.min(3, Math.floor(orderedMatch[1].length / 2))
      nodes.push(
        <div
          key={`${keyPrefix}-ol-${i}`}
          className="flex items-start gap-2 text-sm text-foreground/90"
          style={{ paddingLeft: `${indentLevel * 14 + 4}px` }}
        >
          <span className="font-semibold text-primary text-xs mt-0.5 shrink-0">
            {orderedMatch[2]}.
          </span>
          <span className="min-w-0 flex-1">{formatInline(orderedMatch[3])}</span>
        </div>
      )
      i++
      continue
    }

    // Regular paragraph
    nodes.push(
      <p key={`${keyPrefix}-p-${i}`} className="text-sm text-foreground/90">
        {formatInline(trimmed)}
      </p>
    )
    i++
  }

  return (
    <div key={keyPrefix} className="space-y-1.5">
      {nodes}
    </div>
  )
}

function formatInline(str: string): React.ReactNode[] {
  // Match inline math ($...$ or \(...\)), bold (**...**), italic (*...*), or inline `code`
  const tokenRegex = /(\$[^$\n]+\$|\\\([^\n]+?\\\)|\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`)/g
  const tokens = str.split(tokenRegex)

  return tokens.map((token, i) => {
    if (!token) return null

    // Inline math: $formula$ or \(formula\)
    if (
      (token.startsWith('$') && token.endsWith('$') && token.length > 2) ||
      (token.startsWith('\\(') && token.endsWith('\\)'))
    ) {
      const formula = token.startsWith('$') ? token.slice(1, -1) : token.slice(2, -2)
      const readable = cleanLatexSymbols(formula)
      return (
        <span
          key={i}
          className="inline-block font-serif italic px-1 mx-0.5 rounded bg-muted/60 text-primary font-medium text-[13px]"
          title={formula}
        >
          {readable}
        </span>
      )
    }

    // Bold text: **text** (recursively parses inner math/code)
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {formatInline(token.slice(2, -2))}
        </strong>
      )
    }

    // Italic text: *text*
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return (
        <em key={i} className="italic">
          {formatInline(token.slice(1, -1))}
        </em>
      )
    }

    // Inline code: `code`
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={i}
          className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-foreground border border-border/50"
        >
          {token.slice(1, -1)}
        </code>
      )
    }

    return token
  })
}

function cleanLatexSymbols(latex: string): string {
  return latex
    .replace(/\\ce\{([^}]+)\}/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\rightleftharpoons/g, '⇌')
    .replace(/\\rightarrow|\\to/g, '→')
    .replace(/\\leftarrow/g, '←')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\leq|\\le/g, '≤')
    .replace(/\\geq|\\ge/g, '≥')
    .replace(/\\neq|\\ne/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞')
    .replace(/\\sum/g, '∑')
    .replace(/\\int/g, '∫')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\nu/g, 'ν')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\degree|\^\\circ/g, '°')
    .replace(/\^\{([^}]+)\}/g, '^($1)')
    .replace(/_\{([^}]+)\}/g, '_$1')
}
