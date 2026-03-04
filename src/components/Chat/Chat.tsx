import { useState } from 'react'
import type { Message } from '../../types/chat'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ThemeToggle } from '../ui/ThemeToggle'
import './Chat.css'

// Demo data to showcase all features
const demoMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: 'Can you help me write a React hook for debouncing?',
    timestamp: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
  },
  {
    id: '2',
    role: 'assistant',
    content: `Here's a custom React hook for debouncing values:

\`\`\`typescript
import { useState, useEffect } from 'react';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
\`\`\`

### Usage Example

\`\`\`tsx
function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (debouncedSearch) {
      // Perform API call here
      fetchResults(debouncedSearch);
    }
  }, [debouncedSearch]);

  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  );
}
\`\`\`

**Key benefits:**
- Prevents excessive API calls during rapid typing
- Uses \`useEffect\` cleanup to cancel pending timeouts
- Fully typed with TypeScript generics`,
    timestamp: new Date(Date.now() - 1000 * 60 * 9),
    reasoning: `The user is asking for a debounce hook implementation. I should:

1. Provide a clean, reusable implementation
2. Use TypeScript generics for type safety
3. Include a practical usage example
4. Explain the key benefits

I'll use the standard pattern with useState and useEffect, making sure to clean up the timeout to prevent memory leaks.`,
  },
  {
    id: '3',
    role: 'user',
    content: 'What are the differences between useMemo, useCallback, and React.memo?',
    timestamp: new Date(Date.now() - 1000 * 60 * 7),
  },
  {
    id: '4',
    role: 'assistant',
    content: `Great question! Here's a comparison of these React optimization techniques:

| Feature | Purpose | Memoizes | Use Case |
|---------|---------|----------|----------|
| \`useMemo\` | Cache computed values | Return value | Expensive calculations |
| \`useCallback\` | Cache function references | Function | Callbacks passed to children |
| \`React.memo\` | Prevent re-renders | Component | Pure components |

### useMemo

Caches the **result** of an expensive calculation:

\`\`\`jsx
const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);
\`\`\`

### useCallback

Caches a **function reference** (useful for passing to child components):

\`\`\`jsx
const handleClick = useCallback((id) => {
  setSelected(id);
}, []);
\`\`\`

### React.memo

Wraps a component to prevent re-renders if props haven't changed:

\`\`\`jsx
const ExpensiveList = React.memo(({ items }) => {
  return items.map(item => <Item key={item.id} {...item} />);
});
\`\`\`

> **Pro tip:** Don't optimize prematurely! Only add these when you've identified actual performance issues. Unnecessary memoization adds memory overhead and code complexity.

---

**When to use each:**

- [ ] \`useMemo\` - Filtering/sorting large arrays, complex math
- [ ] \`useCallback\` - Event handlers passed to memoized children
- [ ] \`React.memo\` - Components that render often with same props`,
    timestamp: new Date(Date.now() - 1000 * 60 * 6),
    reasoning: `This is a common React interview question. I need to clearly differentiate between:

1. **useMemo** - for memoizing computed values
2. **useCallback** - for memoizing functions (actually just useMemo for functions)
3. **React.memo** - HOC for component memoization

I'll use a table for quick comparison, code examples for each, and add practical guidance on when to use them. I should also mention that premature optimization is often unnecessary.`,
  },
  {
    id: '5',
    role: 'user',
    content: 'Show me a Python script to analyze CSV data',
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
  },
  {
    id: '6',
    role: 'assistant',
    content: `Here's a comprehensive Python script for CSV analysis using pandas:

\`\`\`python
import pandas as pd
import numpy as np
from pathlib import Path

def analyze_csv(filepath: str) -> dict:
    """
    Analyze a CSV file and return summary statistics.

    Args:
        filepath: Path to the CSV file

    Returns:
        Dictionary containing analysis results
    """
    # Load the data
    df = pd.read_csv(filepath)

    # Basic info
    analysis = {
        'rows': len(df),
        'columns': len(df.columns),
        'column_names': df.columns.tolist(),
        'dtypes': df.dtypes.astype(str).to_dict(),
        'missing_values': df.isnull().sum().to_dict(),
    }

    # Numeric column statistics
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        analysis['numeric_summary'] = df[numeric_cols].describe().to_dict()

    # Categorical column analysis
    cat_cols = df.select_dtypes(include=['object']).columns
    analysis['categorical_unique'] = {
        col: df[col].nunique() for col in cat_cols
    }

    return analysis

# Example usage
if __name__ == '__main__':
    results = analyze_csv('data.csv')

    print(f"Dataset: {results['rows']} rows × {results['columns']} columns")
    print(f"\\nMissing values:")
    for col, count in results['missing_values'].items():
        if count > 0:
            print(f"  {col}: {count}")
\`\`\`

**Output example:**

\`\`\`
Dataset: 1000 rows × 8 columns

Missing values:
  email: 23
  phone: 156
\`\`\`

### Additional useful operations:

\`\`\`python
# Filter rows
filtered = df[df['age'] > 25]

# Group and aggregate
summary = df.groupby('category').agg({
    'sales': ['sum', 'mean'],
    'quantity': 'count'
})

# Export results
summary.to_csv('analysis_results.csv')
\`\`\``,
    timestamp: new Date(Date.now() - 1000 * 60 * 3),
  },
  {
    id: '7',
    role: 'user',
    content: 'Thanks! Can you explain how async/await works in JavaScript?',
    timestamp: new Date(Date.now() - 1000 * 60 * 1),
  },
  {
    id: '8',
    role: 'assistant',
    content: `## Async/Await in JavaScript

Async/await is syntactic sugar over Promises that makes asynchronous code look and behave more like synchronous code.

### The Basics

\`\`\`javascript
// Without async/await (Promise chains)
function fetchUserData(userId) {
  return fetch(\`/api/users/\${userId}\`)
    .then(response => response.json())
    .then(user => fetch(\`/api/posts?userId=\${user.id}\`))
    .then(response => response.json())
    .catch(error => console.error(error));
}

// With async/await (much cleaner!)
async function fetchUserData(userId) {
  try {
    const userResponse = await fetch(\`/api/users/\${userId}\`);
    const user = await userResponse.json();

    const postsResponse = await fetch(\`/api/posts?userId=\${user.id}\`);
    const posts = await postsResponse.json();

    return { user, posts };
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}
\`\`\`

### Key Concepts

1. **\`async\` keyword** - Declares a function that returns a Promise
2. **\`await\` keyword** - Pauses execution until the Promise resolves
3. **Error handling** - Use \`try/catch\` instead of \`.catch()\`

### Parallel Execution

\`\`\`javascript
// Sequential (slow) - each awaits the previous
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();

// Parallel (fast) - all run simultaneously
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
]);
\`\`\`

> ⚠️ **Common mistake:** Using \`await\` in a loop when you could use \`Promise.all\` for parallel execution.

### Real-world Example

\`\`\`javascript
async function processOrders(orderIds) {
  const results = await Promise.allSettled(
    orderIds.map(id => processOrder(id))
  );

  const successful = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const failed = results
    .filter(r => r.status === 'rejected')
    .map(r => r.reason);

  return { successful, failed };
}
\`\`\`

This pattern handles partial failures gracefully!`,
    timestamp: new Date(Date.now() - 1000 * 60 * 0.5),
    reasoning: `The user wants to understand async/await. I should:

1. Start with a clear comparison of Promise chains vs async/await
2. Explain the key keywords and their purpose
3. Show the critical difference between sequential and parallel execution
4. Include a real-world example with Promise.allSettled for handling partial failures
5. Point out common mistakes

This is a fundamental topic so I want to be thorough but also practical.`,
  },
]

function Chat() {
  const [messages, setMessages] = useState<Message[]>(demoMessages)
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content,
      role: 'user',
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // Simulate assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: generateMockResponse(content),
        role: 'assistant',
        timestamp: new Date(),
        reasoning: generateMockReasoning(content),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1500)
  }

  return (
    <div className="chat">
      <header className="chat-header">
        <h1>Chat</h1>
        <ThemeToggle />
      </header>

      <main className="chat-messages">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onSuggestionClick={handleSend}
        />
      </main>

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  )
}

function generateMockReasoning(userMessage: string): string {
  return `Analyzing the user's question about "${userMessage.slice(0, 30)}..."

I need to consider:
1. What specific information they're looking for
2. Their likely experience level
3. Practical examples that would be helpful

Let me formulate a clear, comprehensive response.`
}

function generateMockResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase()

  if (lowerMessage.includes('code') || lowerMessage.includes('function') || lowerMessage.includes('javascript')) {
    return `Here's an example of how you might approach this:

\`\`\`javascript
function example() {
  const data = [1, 2, 3, 4, 5];

  // Process the data
  const result = data
    .filter(n => n > 2)
    .map(n => n * 2);

  return result;
}

console.log(example()); // [6, 8, 10]
\`\`\`

This function demonstrates:
- **Array filtering** with \`filter()\`
- **Array transformation** with \`map()\`
- Clean, readable code structure

Let me know if you'd like me to explain any part in more detail!`
  }

  if (lowerMessage.includes('python')) {
    return `Here's a Python solution:

\`\`\`python
def find_primes(n):
    """Find all prime numbers up to n."""
    primes = []
    for num in range(2, n + 1):
        is_prime = True
        for i in range(2, int(num ** 0.5) + 1):
            if num % i == 0:
                is_prime = False
                break
        if is_prime:
            primes.append(num)
    return primes

# Example usage
print(find_primes(30))
# Output: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
\`\`\`

This uses the **trial division** method. For larger numbers, you might want to use the **Sieve of Eratosthenes** for better performance.`
  }

  if (lowerMessage.includes('sql')) {
    return `Here's a common SQL pattern for debugging:

\`\`\`sql
SELECT
    users.id,
    users.name,
    COUNT(orders.id) as order_count
FROM users
LEFT JOIN orders ON users.id = orders.user_id
WHERE users.created_at > '2024-01-01'
GROUP BY users.id, users.name
HAVING COUNT(orders.id) > 0
ORDER BY order_count DESC;
\`\`\`

Common issues to check:
1. **JOIN type** - Are you using LEFT, RIGHT, or INNER JOIN correctly?
2. **GROUP BY** - All non-aggregated columns must be in GROUP BY
3. **NULL handling** - Use \`COALESCE\` for default values

What specific issue are you encountering?`
  }

  return `That's a great question! Here are some thoughts:

1. **Understanding the problem** - Break it down into smaller parts
2. **Research** - Look for existing solutions and patterns
3. **Implementation** - Start with a simple solution, then optimize

| Step | Action | Priority |
|------|--------|----------|
| 1 | Analyze requirements | High |
| 2 | Design solution | High |
| 3 | Implement | Medium |
| 4 | Test & refine | Medium |

Would you like me to go deeper into any of these areas?

> *Tip:* You can use markdown formatting in your messages, including **bold**, *italic*, and \`code\` snippets.`
}

export default Chat
