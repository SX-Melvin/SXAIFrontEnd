import type { Message } from '../types/chat'
import { getAuthToken } from './api'

const API_BASE = import.meta.env.VITE_API_URL || ''
const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID || 'test'
const USER_ID = import.meta.env.VITE_USER_ID || ''
const DEBUG = import.meta.env.VITE_DEBUG === 'true'

function debug(...args: unknown[]) {
  if (DEBUG) {
    console.log(...args)
  }
}

export interface StreamChunk {
  type:
    | 'thinking'
    | 'query_rewritten'
    | 'sources'
    | 'reasoning_start'
    | 'reasoning'
    | 'reasoning_end'
    | 'content'
    | 'tool_call_start'
    | 'tool_call_end'
    | 'verification_start'
    | 'verification_end'
    | 'citations'
    | 'title'
    | 'done'
    | 'error'
  data?: string
  title?: string
  tokensUsed?: number
  toolName?: string
  sources?: Array<{ fileName: string; chunkCount: number }>
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

export interface StreamChatOptions {
  documentNodeIds?: string[]
}

/**
 * Stream chat response from the API using session-based endpoint.
 * Yields chunks of content as they arrive.
 *
 * When sessionId is present, backend maintains conversation history,
 * so we only send the latest user message.
 */
export async function* streamChat(
  sessionId: string | null,
  messages: Message[],
  options?: StreamChatOptions
): AsyncGenerator<StreamChunk> {
  const url = `${API_BASE}/api/workspaces/${WORKSPACE_ID}/chat/stream`

  let messagesToSend: Array<Record<string, unknown>>

  if (sessionId) {
    // Backend maintains history - only send the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMessage) {
      yield { type: 'error', data: 'No user message found' }
      return
    }

    const msg: Record<string, unknown> = {
      role: 'user',
      content: lastUserMessage.content || '',
    }

    // Add nodeIds if we have document references
    if (options?.documentNodeIds && options.documentNodeIds.length > 0) {
      msg.nodeIds = options.documentNodeIds
      debug('Adding nodeIds to message:', options.documentNodeIds)
    }

    messagesToSend = [msg]
  } else {
    // No session - send all messages for context
    messagesToSend = messages
      .filter((m) => m.role && m.content !== undefined)
      .map((m, index, arr) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content || '',
        }
        // Add nodeIds to the last user message if we have document references
        const isLastUserMessage = m.role === 'user' &&
          arr.slice(index + 1).every((next) => next.role !== 'user')
        if (isLastUserMessage && options?.documentNodeIds && options.documentNodeIds.length > 0) {
          msg.nodeIds = options.documentNodeIds
          debug('Adding nodeIds to message:', options.documentNodeIds)
        }
        return msg
      })
  }

  debug('Sending messages:', messagesToSend)

  const body: Record<string, unknown> = {
    messages: messagesToSend,
    // Always enable reasoning mode
    enableReasoning: true,
    streamReasoning: true,
  }

  // Only include sessionId if valid
  if (sessionId) {
    body.sessionId = sessionId
  }

  // Include userId for secure workspaces
  if (USER_ID) {
    body.userId = USER_ID
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`
    try {
      const errorData = await response.json()
      debug('Chat stream error:', response.status, errorData)
      if (errorData?.message) {
        errorMessage = errorData.message
      } else if (errorData?.error) {
        errorMessage = errorData.error
      }
    } catch {
      // Response body is not JSON
    }
    yield { type: 'error', data: errorMessage }
    return
  }

  if (!response.body) {
    yield { type: 'error', data: 'Response body is not readable' }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine) continue

        // Handle SSE format: "event: <type>" and "data: <json>"
        if (trimmedLine.startsWith('event:')) continue

        if (trimmedLine.startsWith('data:')) {
          const dataStr = trimmedLine.slice(5).trim()

          if (!dataStr || dataStr === '[DONE]') {
            yield { type: 'done' }
            continue
          }

          try {
            const parsed = JSON.parse(dataStr)

            // Map backend event types to our StreamChunk format
            const eventType = parsed.event || parsed.type

            if (eventType === 'thinking') {
              yield { type: 'thinking', data: parsed.message || parsed.data || '' }
            } else if (eventType === 'query_rewritten') {
              yield { type: 'query_rewritten', data: parsed.rewrittenQuery || parsed.query || '' }
            } else if (eventType === 'sources') {
              yield { type: 'sources', sources: parsed.sources || [], data: `Found ${parsed.sources?.length || 0} sources` }
            } else if (eventType === 'reasoning_start') {
              yield { type: 'reasoning_start' }
            } else if (eventType === 'reasoning') {
              yield { type: 'reasoning', data: parsed.delta || parsed.message || parsed.data || '' }
            } else if (eventType === 'reasoning_end') {
              yield { type: 'reasoning_end' }
            } else if (eventType === 'content') {
              yield { type: 'content', data: parsed.delta || parsed.text || parsed.data || parsed.content || '' }
            } else if (eventType === 'tool_call_start') {
              yield { type: 'tool_call_start', toolName: parsed.toolName || parsed.name || 'tool', data: parsed.message || '' }
            } else if (eventType === 'tool_call_end') {
              yield { type: 'tool_call_end', toolName: parsed.toolName || parsed.name || 'tool', data: parsed.message || '' }
            } else if (eventType === 'verification_start') {
              yield { type: 'verification_start', data: 'Verifying facts...' }
            } else if (eventType === 'verification_end') {
              yield { type: 'verification_end', data: parsed.message || '' }
            } else if (eventType === 'citations') {
              yield { type: 'citations', data: JSON.stringify(parsed.citations || []) }
            } else if (eventType === 'title') {
              yield { type: 'title', title: parsed.title || '' }
            } else if (eventType === 'done') {
              yield { type: 'done', tokensUsed: parsed.tokensUsed }
            } else if (eventType === 'error') {
              yield { type: 'error', data: parsed.data || parsed.message || 'Unknown error' }
            } else if (eventType === 'suggestions') {
              // Informational event - skip
            } else if (parsed.delta) {
              yield { type: 'content', data: parsed.delta }
            } else if (parsed.content) {
              yield { type: 'content', data: parsed.content }
            }
          } catch {
            // Not JSON, treat as raw content
            if (dataStr) {
              yield { type: 'content', data: dataStr }
            }
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const trimmedLine = buffer.trim()
      if (trimmedLine.startsWith('data:')) {
        const dataStr = trimmedLine.slice(5).trim()
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr)
            if (parsed.content) {
              yield { type: 'content', data: parsed.content }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Abort controller for cancelling streams
 */
export function createAbortController(): AbortController {
  return new AbortController()
}
