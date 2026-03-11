import { useState, useEffect } from 'react'
import type { Message } from '../../types/chat'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MessageBubbleProps {
  message: Message
  onRegenerate?: () => void
  onEdit?: (newContent: string) => void
}

export function MessageBubble({ message, onRegenerate }: MessageBubbleProps) {
  // Auto-expand reasoning while streaming with no content, auto-collapse when content arrives
  const isThinking = message.isStreaming && message.reasoning && !message.content
  const [reasoningExpanded, setReasoningExpanded] = useState(isThinking)

  // Update expanded state based on streaming status
  useEffect(() => {
    if (isThinking) {
      // Expand while thinking (streaming reasoning, no content yet)
      setReasoningExpanded(true)
    } else if (message.content && message.reasoning) {
      // Collapse when content starts arriving
      setReasoningExpanded(false)
    }
  }, [isThinking, message.content, message.reasoning])
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className={`message message-${message.role}`}>
      {!isUser && (
        <div className="message-avatar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.1"/>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="12" cy="10" r="3" fill="currentColor"/>
            <path d="M12 14c-3 0-5 1.5-5 3v1h10v-1c0-1.5-2-3-5-3z" fill="currentColor"/>
          </svg>
        </div>
      )}
      {isUser && (
        <div className="message-avatar message-avatar-user">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="currentColor"/>
            <text x="12" y="16" textAnchor="middle" fill="white" fontSize="12" fontWeight="500">U</text>
          </svg>
        </div>
      )}
      <div className="message-content-wrapper">
        {message.reasoning && (
          <div className="message-reasoning">
            <button
              className={`reasoning-toggle ${isThinking ? 'thinking' : ''}`}
              onClick={() => setReasoningExpanded(!reasoningExpanded)}
              aria-expanded={reasoningExpanded || undefined}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`reasoning-icon ${reasoningExpanded ? 'expanded' : ''}`}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span className="reasoning-label">
                {message.reasoningLabel ? message.reasoningLabel : isThinking ? 'Thinking...' : 'Thinking'}
              </span>
              {!reasoningExpanded && (
                <span className="reasoning-preview">
                  {message.reasoning.slice(0, 50)}...
                </span>
              )}
            </button>
            {reasoningExpanded && (
              <div className="reasoning-content">
                <MarkdownRenderer content={message.reasoning} />
                <ul style={{marginLeft: "20px", marginTop: "10px"}}>
                  {message.steps?.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className={`message-content ${message.isStreaming ? 'streaming' : ''}`}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
          {message.isStreaming && (
            <span className="streaming-cursor" />
          )}
        </div>
        <div className="message-footer" style={{}}>
          <span className="message-timestamp">{formatTime(message.timestamp)}</span>
          {!message.isStreaming && message.content && !isUser && (
            <div className="message-actions">
              <button
                className="message-action"
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy message'}
                title={copied ? 'Copied!' : 'Copy'}
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
              {!isUser && onRegenerate && (
                <button
                  className="message-action"
                  onClick={onRegenerate}
                  aria-label="Regenerate response"
                  title="Regenerate"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
