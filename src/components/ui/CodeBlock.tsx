import { useMemo } from 'react'
import hljs from 'highlight.js'
import { CopyButton } from './CopyButton'

interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const highlightedCode = useMemo(() => {
    if (language && hljs.getLanguage(language)) {
      try {
        return hljs.highlight(code, { language }).value
      } catch {
        // Fall back to auto-detection
      }
    }
    // Auto-detect language
    try {
      return hljs.highlightAuto(code).value
    } catch {
      // Return escaped code if highlighting fails
      return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }
  }, [code, language])

  const displayLanguage = language || 'plaintext'

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-language">{displayLanguage}</span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code
          className={language ? `language-${language} hljs` : 'hljs'}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  )
}
