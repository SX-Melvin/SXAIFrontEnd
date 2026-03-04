import { BASE_API_URL } from '../config/env'
import type { Conversation, Session, BackendMessage, Message } from '../types/chat'
import backendApi from './backend_api'
import { sessionsApi } from './sessions'

const ACTIVE_SESSION_KEY = 'leapcount_active_session'

/**
 * Convert backend Session to frontend Conversation
 * Note: API returns sessionId in list, id in single get
 */
function sessionToConversation(session: Session): Conversation {
  // Handle both 'id' and 'sessionId' from API
  const id = session.id || session.sessionId || ''

  // Handle different message field names from API (messages, history, etc.)
  const sessionAny = session as unknown as Record<string, unknown>
  const rawMessages = (session.messages || sessionAny.history || sessionAny.messageHistory || []) as BackendMessage[]
  const messages = rawMessages.map(backendMessageToMessage)

  // Handle different date field names (createdAt, created_at, etc.)
  const createdAtStr = session.createdAt || (sessionAny.created_at as string) || ''
  const updatedAtStr = session.updatedAt || (sessionAny.updated_at as string) || ''
  const createdAt = createdAtStr ? new Date(createdAtStr) : new Date()
  const updatedAt = updatedAtStr ? new Date(updatedAtStr) : new Date()

  return {
    id,
    title: session.title || 'New Conversation',
    messages,
    createdAt,
    updatedAt,
  }
}

/**
 * Convert backend message to frontend Message
 */
function backendMessageToMessage(msg: BackendMessage): Message {
  // Handle different field names from API
  const msgAny = msg as unknown as Record<string, unknown>
  const id = msg.id || (msgAny.messageId as string) || crypto.randomUUID()
  const timestamp = msg.timestamp || (msgAny.createdAt as string) || new Date().toISOString()
  const content = msg.content || (msgAny.text as string) || ''

  return {
    id,
    role: msg.role,
    content,
    timestamp: new Date(timestamp),
    reasoning: msg.reasoning,
    tokensUsed: msg.tokensUsed,
    sources: msg.sources,
    toolCalls: msg.toolCalls,
  }
}

/**
 * List all conversations (sessions) for the current workspace/user
 */
export async function listConversations(): Promise<Conversation[]> {
  const response = await sessionsApi.list()
  // Handle various response formats: array, { sessions: [] }, { data: [] }, etc.
  let sessions: Session[]
  if (Array.isArray(response)) {
    sessions = response
  } else if (response && typeof response === 'object') {
    const resp = response as unknown as Record<string, unknown>
    sessions = (resp.sessions || resp.data || resp.items || []) as Session[]
  } else {
    sessions = []
  }
  // Filter out sessions without valid IDs (API returns sessionId in list, id in get)
  return sessions
    .filter((s) => s && (s.id || s.sessionId))
    .map(sessionToConversation)
}

/**
 * Get a single conversation by ID with full message history
 */
export async function getConversation(id: string): Promise<Conversation | null> {
  if (!id) return null
  try {
    const session = await sessionsApi.get(id)
    return sessionToConversation(session)
  } catch {
    return null
  }
}

/**
 * Create a new conversation (session)
 */
export async function createConversation(title?: string): Promise<Conversation> {
  const session = await sessionsApi.create(title)
  return sessionToConversation(session)
}

/**
 * Update a conversation title
 */
export async function updateConversation(
  id: string,
  updates: { title?: string }
): Promise<Conversation> {
  const session = await sessionsApi.update(id, updates)
  return sessionToConversation(session)
}

/**
 * Delete a conversation (session)
 */
export async function deleteConversation(id: string): Promise<void> {
  await sessionsApi.delete(id)
}

/**
 * Get the active session ID from localStorage
 */
export function getActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY)
}

/**
 * Save the active session ID to localStorage
 */
export function setActiveSessionId(sessionId: string | null): void {
  if (sessionId) {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId)
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY)
  }
}
