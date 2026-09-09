import type { ReactNode } from 'react'

/**
 * Tiny, dependency-free Markdown renderer for product descriptions.
 *
 * Supports the subset that shows up in real Creem descriptions: paragraphs,
 * headings, bullet/numbered lists, bold, italic, inline code, and links.
 *
 * Security: descriptions are untrusted API content. We never use
 * `dangerouslySetInnerHTML`, and link hrefs are protocol-checked so a
 * `javascript:`/`data:` URL can never become a clickable link.
 */

const SAFE_HREF = /^(https?:\/\/|mailto:)/i

// Inline tokens, tried left-to-right at each position.
const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let i = 0
  let match: RegExpExecArray | null
  INLINE.lastIndex = 0
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${keyPrefix}-${i++}`
    const [, linkText, href, boldA, boldB, italA, italB, code] = match
    if (linkText !== undefined) {
      nodes.push(
        SAFE_HREF.test(href) ? (
          <a key={key} href={href} target='_blank' rel='noopener noreferrer' className='text-ui-link font-bold underline'>
            {linkText}
          </a>
        ) : (
          linkText
        )
      )
    } else if (boldA !== undefined || boldB !== undefined) {
      nodes.push(
        <strong key={key} className='text-ui-text font-black'>
          {boldA ?? boldB}
        </strong>
      )
    } else if (italA !== undefined || italB !== undefined) {
      nodes.push(<em key={key}>{italA ?? italB}</em>)
    } else if (code !== undefined) {
      nodes.push(
        <code key={key} className='bg-ui-surface-subtle text-ui-text rounded px-1 py-0.5 font-mono text-[0.9em]'>
          {code}
        </code>
      )
    }
    lastIndex = INLINE.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

const HEADING_SIZE = ['text-base', 'text-base', 'text-sm', 'text-sm', 'text-sm', 'text-sm']

/** Renders a Markdown string as safe React nodes. */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let key = 0
  let i = 0
  const flushParagraph = () => {
    if (para.length === 0) return
    blocks.push(
      <p key={`p-${key++}`} className='leading-relaxed break-words'>
        {renderInline(para.join(' '), `p${key}`)}
      </p>
    )
    para = []
  }
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      flushParagraph()
      i++
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      const level = heading[1].length
      blocks.push(
        <p key={`h-${key++}`} className={`text-ui-text font-black ${HEADING_SIZE[level - 1]}`}>
          {renderInline(heading[2], `h${key}`)}
        </p>
      )
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={`ul-${key++}`} className='flex list-disc flex-col gap-1 pl-5'>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ul${key}-${idx}`)}</li>
          ))}
        </ul>
      )
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={`ol-${key++}`} className='flex list-decimal flex-col gap-1 pl-5'>
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `ol${key}-${idx}`)}</li>
          ))}
        </ol>
      )
      continue
    }
    para.push(line)
    i++
  }
  flushParagraph()
  return <div className={`flex min-w-0 flex-col gap-2 break-words ${className}`}>{blocks}</div>
}
