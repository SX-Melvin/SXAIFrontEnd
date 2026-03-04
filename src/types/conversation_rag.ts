export interface GetConversationsResponse {
  id: number
  userId: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface GetConversationResponse {
  id: number
  name: string
  userId: number
  createdAt: string
  updatedAt: string
}

export interface GetChatStepResponse {
  id: number
  chatID: number
  message: string
  createdAt: string
}

export interface UpdateConversationRequest {
  name: string
}

export interface GetChatsResponse {
  id: number
  conversationID: number
  message: string
  reasoning: string
  steps: GetChatStepResponse[]
  type: string
  createdAt: string
}