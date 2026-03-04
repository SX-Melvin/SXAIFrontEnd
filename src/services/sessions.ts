import type { Session } from '../types/chat'
import { api } from './api'

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID || 'test'
const USER_ID = import.meta.env.VITE_USER_ID || ''

export interface SessionsListResponse {
  sessions: Session[]
  total: number
  page: number
  limit: number
}

export const sessionsApi = {
  /**
   * Create a new session (with optional userId)
   */
  create: async (title?: string): Promise<Session> => {
    return api.post<Session>(`/api/workspaces/${WORKSPACE_ID}/sessions`, {
      title: title || 'New Conversation',
      ...(USER_ID && { userId: USER_ID }),
    })
  },

  /**
   * List sessions (filtered by userId if set)
   */
  list: async (page = 1, limit = 50): Promise<SessionsListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })
    if (USER_ID) {
      params.set('userId', USER_ID)
    }
    return api.get<SessionsListResponse>(`/api/workspaces/${WORKSPACE_ID}/sessions?${params}`)
  },

  /**
   * Get a single session with full message history
   */
  get: async (sessionId: string): Promise<Session> => {
    return api.get<Session>(`/api/workspaces/${WORKSPACE_ID}/sessions/${sessionId}?includeMessages=true`)
  },

  /**
   * Update session (title, settings)
   */
  update: (sessionId: string, data: { title?: string }): Promise<Session> =>
    api.patch(`/api/workspaces/${WORKSPACE_ID}/sessions/${sessionId}`, data),

  /**
   * Delete a session
   */
  delete: (sessionId: string): Promise<void> => {
    const params = USER_ID ? `?userId=${USER_ID}` : ''
    return api.delete(`/api/workspaces/${WORKSPACE_ID}/sessions/${sessionId}${params}`)
  },

  /**
   * Get archived messages for a session
   */
  getArchive: (sessionId: string): Promise<{ messages: Session['messages']; summary?: string }> =>
    api.get(`/api/workspaces/${WORKSPACE_ID}/sessions/${sessionId}/archive`),
}
