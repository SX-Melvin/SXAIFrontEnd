import { BASE_API_URL } from '../config/env'

export interface StreamChunkRAG {
  type:
    | 'thinking'
    | 'reasoning_start'
    | 'reasoning'
    | 'reasoning_end'
    | 'step'
    | 'content'
    | 'done'
    | 'error'
  data?: string
}

export interface StreamChatOptions {
  prompt: string
  otcsToken: string
  conversationId?: number | null
  folderId?: number[] | null
}

/**
 * Stream chat response from the API using session-based endpoint.
 * Yields chunks of content as they arrive.
 *
 * When sessionId is present, backend maintains conversation history,
 * so we only send the latest user message.
 */
export async function* streamRAGChat(
  options?: StreamChatOptions
): AsyncGenerator<StreamChunkRAG> {
  const response = await fetch(`${BASE_API_URL}/api/agent/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  })

  if (!response.ok || !response.body) {
    yield { type: 'error', data: `Request failed ${response.status}` }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")

  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Your backend sends JSON + "\n\n"
    const parts = buffer.split("\n\n")
    buffer = parts.pop() || ""

    for (const part of parts) {
      if (!part.trim()) continue

      try {
        const json = JSON.parse(part.replace(/^data: /, ""))
        yield json
      } catch (err) {
        yield { type: "error", data: "Invalid JSON chunk" }
      }
    }
  }
}

/**
 * Abort controller for cancelling streams
 */
export function createAbortController(): AbortController {
  return new AbortController()
}
