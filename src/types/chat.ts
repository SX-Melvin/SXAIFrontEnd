export interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

export type AttachmentUploadStatus = 'pending' | 'uploading' | 'completed' | 'error'

export interface Attachment {
  id: string
  file: File
  name: string
  size: number
  type: string
  preview?: string
  // Upload status fields
  uploadStatus?: AttachmentUploadStatus
  uploadProgress?: number
  uploadError?: string
  // Result from Document API
  nodeId?: string
  jobId?: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
  status: 'pending' | 'executed' | 'rejected'
  result?: unknown
}

export interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  reasoning?: string
  steps?: string[]
  reasoningLabel?: string
  isStreaming?: boolean
  attachments?: Attachment[]
  // Backend fields
  tokensUsed?: number
  sources?: string[]
  toolCalls?: ToolCall[]
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

// Backend Session type (maps to Conversation in frontend)
// Note: API returns sessionId in list, id in single get
export interface Session {
  id?: string
  sessionId?: string
  title: string
  createdAt: string
  updatedAt: string
  userId?: string
  messageCount?: number
  messages?: BackendMessage[]
  settings?: {
    topK?: number
    enableSuggestions?: boolean
  }
}

export interface BackendMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  reasoning?: string
  tokensUsed?: number
  sources?: string[]
  toolCalls?: ToolCall[]
}

export interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  isLoading: boolean
}

export type Theme = 'light' | 'dark' | 'system'
