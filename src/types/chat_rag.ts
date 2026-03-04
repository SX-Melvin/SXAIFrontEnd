export interface Message {
  id: number
  conversationID: number
  message: string
  reasoning: string
  steps: ChatStep[]
  type: 'user' | 'assistant'
  createdAt: Date
}

export interface ChatStep {
  id: number
  chatID: number
  message: string
  createdAt: Date
}

export interface Conversation {
  id: number
  name: string
  chats: Message[]
  createdAt: Date
  updatedAt: Date
}