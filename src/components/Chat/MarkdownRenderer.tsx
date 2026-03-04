import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { CodeBlock } from '../ui/CodeBlock'

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const codeString = String(children).replace(/\n$/, '')

      // Check if this is an inline code or a code block
      const isInline = !className && !codeString.includes('\n')

      if (isInline) {
        return (
          <code className="inline-code" {...props}>
            {children}
          </code>
        )
      }

      return (
        <CodeBlock
          code={codeString}
          language={match ? match[1] : undefined}
        />
      )
    },
    pre({ children }) {
      // The pre wrapper is handled by CodeBlock, so we just return children
      return <>{children}</>
    },
    a({ href, children, ...props }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      )
    },
  }

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
