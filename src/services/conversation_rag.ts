import { BASE_API_URL } from '../config/env'
import { CommonAPIResponse, Pagination } from '../types/api'
import { GetChatsResponse, GetConversationResponse, GetConversationsResponse, UpdateConversationRequest } from '../types/conversation_rag'
import backendApi from './backend_api'

/**
/**
 * Get a single conversation by ID with full message history
 */
export async function getRAGConversation(userId: number): Promise<CommonAPIResponse<Pagination<GetConversationsResponse>> | null> {
  if (!userId) return null
  try {
    const session = await backendApi.get<CommonAPIResponse<Pagination<GetConversationsResponse>>>(`${BASE_API_URL}/api/conversation/user/${userId}/Conversation`)
    return session.data;
  } catch {
    return null
  }
}

/**
 * Get a single conversation by ID with full chat history
 */
export async function getRAGConversationById(id: number): Promise<CommonAPIResponse<Pagination<GetChatsResponse>> | null> {
  if (!id) return null
  try {
    const session = await backendApi.get<CommonAPIResponse<Pagination<GetChatsResponse>>>(`${BASE_API_URL}/api/conversation/${id}`)
    return session.data
  } catch {
    return null
  }
}

/**
 * Create a new conversation (session)
 */
export async function createRAGConversation(title?: string, userId?: number): Promise<CommonAPIResponse<GetConversationResponse>> {
  const session = await backendApi.post(`${BASE_API_URL}/api/conversation`, { name: title, userId })
  return session.data;
}

/**
 * Update a conversation name
 */
export async function updateRAGConversationName(id: number, name: string): Promise<void> {
  const body: UpdateConversationRequest = { name }
  await backendApi.put(`${BASE_API_URL}/api/conversation/${id}/Name`, body)
}

/**
 * Delete a conversation (session)
 */
export async function deleteRAGConversation(id: number): Promise<void> {
  await backendApi.delete(`${BASE_API_URL}/api/conversation/${id}`)
}
