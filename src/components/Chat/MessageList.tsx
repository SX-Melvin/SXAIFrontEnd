import { useRef, useEffect, useState } from 'react'
import type { Message } from '../../types/chat'
import { MessageBubble } from './MessageBubble'
import { EmptyState } from './EmptyState'

const THINKING_MESSAGES = [
  'Thinking about your question...',
  'Searching the workspace...',
  'Finding the best approach...',
  'Deep diving into the details...',
  'Analyzing the context...',
  'Processing your request...',
  'Looking for relevant information...',
  'Gathering insights...',
  'Connecting the dots...',
  'Reviewing the documents...',
  'Formulating a response...',
  'Checking the knowledge base...',
  'Piecing together the answer...',
  'Exploring related topics...',
  'Running through possibilities...',
  'Examining the data...',
  'Working on your query...',
  'Digging deeper...',
  'Considering different angles...',
  'Synthesizing information...',
  'Mapping out the solution...',
  'Evaluating the options...',
  'Scanning for matches...',
  'Building the response...',
  'Cross-referencing sources...',
  'Putting it all together...',
  'Almost there...',
  'Reasoning through this...',
  'Finding the right words...',
  'Crafting your answer...',
  'Sifting through the details...',
  'Organizing my thoughts...',
  'Looking at the big picture...',
  'Breaking down the problem...',
  'Searching for patterns...',
  'Consulting the archives...',
  'Running the analysis...',
  'Weighing the evidence...',
  'Preparing the response...',
  'Crunching the information...',
  'Exploring every angle...',
  'Double-checking the facts...',
  'Mining the knowledge graph...',
  'Processing the query...',
  'Assembling the pieces...',
  'Refining the answer...',
  'Investigating further...',
  'Pulling together resources...',
  'Making sense of it all...',
  'Working through the logic...',
]

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  processingStatus?: string | null
  onSuggestionClick?: (suggestion: string) => void
  onRegenerate?: (messageIndex: number) => void
  onEditMessage?: (messageIndex: number, newContent: string) => void
}

export function MessageList({ messages, isLoading, processingStatus, onSuggestionClick, onRegenerate, onEditMessage }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Cycle through placeholder messages every 5 seconds while loading
  useEffect(() => {
    if (!isLoading) {
      setPlaceholderIndex(0)
      return
    }

    // Pick a random starting index
    setPlaceholderIndex(Math.floor(Math.random() * THINKING_MESSAGES.length))

    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => {
        // Pick a different random index
        let next = Math.floor(Math.random() * THINKING_MESSAGES.length)
        while (next === prev && THINKING_MESSAGES.length > 1) {
          next = Math.floor(Math.random() * THINKING_MESSAGES.length)
        }
        return next
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [isLoading])

  // Show placeholder if loading and no real status from backend
  const displayStatus = processingStatus || (isLoading ? THINKING_MESSAGES[placeholderIndex] : null)

  if (messages.length === 0) {
    return <EmptyState onSuggestionClick={onSuggestionClick} />
  }

  return (
    <div className="message-list">
      {messages.map((message, index) => {
        // Hide empty streaming assistant message (we show loading indicator instead)
        if (message.role === 'assistant' && message.isStreaming && !message.content && !message.reasoning) {
          return null
        }
        return (
          <MessageBubble
            key={message.id}
            message={message}
            onRegenerate={
              message.role === 'assistant' && onRegenerate && !isLoading
                ? () => onRegenerate(index)
                : undefined
            }
            onEdit={
              message.role === 'user' && onEditMessage && !isLoading
                ? (newContent: string) => onEditMessage(index, newContent)
                : undefined
            }
          />
        )
      })}
      {/* Show loading status when streaming assistant message has no content yet */}
      {isLoading && (() => {
        const lastMsg = messages[messages.length - 1]
        const showLoading = lastMsg?.role !== 'assistant' ||
          (lastMsg?.isStreaming && !lastMsg?.content && !lastMsg?.reasoning)
        return showLoading
      })() && (
        <div className="message message-assistant loading-message">
          <div className="message-avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.1"/>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="10" r="3" fill="currentColor"/>
              <path d="M12 14c-3 0-5 1.5-5 3v1h10v-1c0-1.5-2-3-5-3z" fill="currentColor"/>
            </svg>
          </div>
          <div className="message-content-wrapper">
            <div className="message-content">
              <div className="processing-status-wrapper">
                <svg className="processing-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                {displayStatus && (
                  <span className="processing-status">{displayStatus}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
