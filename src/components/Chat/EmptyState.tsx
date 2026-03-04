interface EmptyStateProps {
  onSuggestionClick?: (suggestion: string) => void
}

const suggestions = [
  'Explain how async/await works in JavaScript',
  'Write a Python function to find prime numbers',
  'What are the best practices for React hooks?',
  'Help me debug a SQL query',
]

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <div className="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2>How can I help you today?</h2>
        <p>Start a conversation or try one of these suggestions:</p>
        <div className="suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className="suggestion-button"
              onClick={() => onSuggestionClick?.(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
