import { useState, useCallback, useEffect, useRef } from 'react'
import type { Message, Conversation, Attachment } from '../../types/chat'
import type { GetConversationResponse } from '../../types/conversation_rag'
import { streamRAGChat } from '../../services/chat_rag'
import {
  getRAGConversation,
  getRAGConversationById,
  createRAGConversation,
  deleteRAGConversation,
  updateRAGConversationName,
} from '../../services/conversation_rag'
import { setActiveSessionId } from '../../services/conversations'
import { Sidebar } from './Sidebar'
import { MessageList } from './MessageList'
import { ChatWithRAGInput, ChatInputHandle } from './ChatWithRAGInput'
import { KeyboardShortcuts } from '../ui/KeyboardShortcuts'
import './ChatLayout.css'
import './Chat.css'
import { useAuth } from '../../context/AuthContext'
import { getUserInfo } from '../../utils/get_user_info'
import { UserInfo } from '../../services/auth'
import { refreshOTCSToken } from '../../utils/refresh_otcs_token'
import { constructLink } from '../../utils/construct_link'
import { generateUUID } from '../../utils/uuid'

function ragToConversation(rag: GetConversationResponse): Conversation {
  return {
    id: String(rag.id),
    title: rag.name || 'New Conversation',
    messages: [],
    createdAt: new Date(rag.createdAt),
    updatedAt: new Date(rag.updatedAt),
  }
}

export function ChatWithRAGLayout() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)
  const [user, setUser] = useState<UserInfo | null>()
  const [showShortcuts, setShowShortcuts] = useState(false)
  const auth = useAuth();
  const chatInputRef = useRef<ChatInputHandle>(null)
  const abortRef = useRef(false)

  // Get session ID from URL path (e.g., /rag/session-id)
  const getSessionIdFromUrl = useCallback(() => {
    const path = window.location.pathname
    const match = path.match(/\/rag\/([^/]+)/)
    return match ? match[1] : null
  }, [])

  useEffect(() => {
    const userInfo = getUserInfo();
    setUser(userInfo);
  }, [])

  // Ref for focusing chat input
  async function loadConversations() {
    try {
      const userInfo = getUserInfo();
      if(userInfo != null) {
        const result = await getRAGConversation(userInfo.otcsUserId);
        if (result?.data) {
          setConversations(result.data.data.map(ragToConversation))
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoadingConversations(false)
    }
  }

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [auth.user?.id])

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const sessionId = event.state?.sessionId || getSessionIdFromUrl()
      if (sessionId && sessionId !== activeConversationId) {
        setActiveConversationId(sessionId)
        setActiveSessionId(sessionId)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [activeConversationId, getSessionIdFromUrl])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifier = isMac ? e.metaKey : e.ctrlKey

      // Ctrl/Cmd + K: New chat
      if (modifier && e.key === 'k') {
        e.preventDefault()
        handleNewChat()
        setTimeout(() => chatInputRef.current?.focus(), 100)
      }

      // Ctrl/Cmd + /: Focus input
      if (modifier && e.key === '/') {
        e.preventDefault()
        chatInputRef.current?.focus()
      }

      // Escape: Close sidebar on mobile
      if (e.key === 'Escape' && sidebarOpen && window.innerWidth <= 768) {
        setSidebarOpen(false)
      }

      // Ctrl/Cmd + ?: Show keyboard shortcuts
      if (modifier && e.key === '?') {
        e.preventDefault()
        setShowShortcuts(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const messages = activeConversation?.messages || []

  const handleNewChat = useCallback(async () => {
    try {
      const result = await createRAGConversation('New Conversation', getUserInfo()?.otcsUserId)
      if (result?.data) {
        const newConversation = ragToConversation({
          id: result.data.id,
          updatedAt: result.data.updatedAt,
          userId: result.data.userId,
          createdAt: result.data.createdAt,
          name: result.data.name
        })
        setConversations((prev) => [newConversation, ...prev])
        setActiveConversationId(newConversation.id)
        setActiveSessionId(newConversation.id)
        await loadConversations() // Refresh conversation list to get the new conversation
        window.history.pushState({ sessionId: newConversation.id }, '', constructLink(`/rag/${newConversation.id}`))
      }
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }, [])

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteRAGConversation(Number(id))
        setConversations((prev) => {
          const filtered = prev.filter((c) => c.id !== id)
          // Update active conversation if we deleted the active one
          if (activeConversationId === id) {
            const newActiveId = filtered[0]?.id || null
            setActiveConversationId(newActiveId)
            setActiveSessionId(newActiveId)
          }
          return filtered
        })
      } catch (error) {
        console.error('Failed to delete conversation:', error)
      }
    },
    [activeConversationId]
  )

  const handleRenameConversation = useCallback(
    async (id: string, newName: string) => {
      try {
        await updateRAGConversationName(Number(id), newName)
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, title: newName, updatedAt: new Date() } : c
          )
        )
      } catch (error) {
        console.error('Failed to rename conversation:', error)
      }
    },
    []
  )

  const handleStop = useCallback(() => {
    abortRef.current = true
    setIsLoading(false)
    setProcessingStatus(null)
  }, [])

  const handleSend = useCallback(
    async (content: string, messageAttachments?: Attachment[], selectedFileNodeIds?: number[]) => {
      let convId = activeConversationId

      // Create new conversation if none active
      if (!convId) {
        try {
          const result = await createRAGConversation('New Conversation', getUserInfo()?.otcsUserId)
          if (result?.data) {
            const newConversation = ragToConversation(result.data)
            setConversations((prev) => [newConversation, ...prev])
            convId = newConversation.id
            setActiveConversationId(convId)
            setActiveSessionId(convId)
          } else {
            return
          }
        } catch (error) {
          console.error('Failed to create conversation:', error)
          return
        }
      }

      // Upload attachments to Document API if any
      let uploadedAttachments = messageAttachments || []

      const userMessage: Message = {
        id: generateUUID(),
        content,
        role: 'user',
        timestamp: new Date(),
        attachments: uploadedAttachments,
      }

      // Add user message (title will be updated via 'title' event from API)
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === convId) {
            return {
              ...conv,
              messages: [...conv.messages, userMessage],
              updatedAt: new Date(),
            }
          }
          return conv
        })
      )

      // Create placeholder assistant message for streaming
      const assistantMessageId = generateUUID()
      const assistantMessage: Message = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        timestamp: new Date(),
        isStreaming: true,
      }

      // Add empty assistant message
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === convId) {
            return {
              ...conv,
              messages: [...conv.messages, assistantMessage],
              updatedAt: new Date(),
            }
          }
          return conv
        })
      )

      setIsLoading(true)
      setProcessingStatus(null) // Let MessageList show random placeholder messages
      abortRef.current = false

      try {
        // Stream the response
        let currentReasoning = ''
        for await (const chunk of streamRAGChat({ otcsToken: localStorage.getItem('otcs_token') ?? "", prompt: content, conversationId: Number(convId), folderId: selectedFileNodeIds })) {
          // Check if user requested stop
          if (abortRef.current) {
            break
          }

          if (chunk.type === 'thinking') {
            setConversations((prev) =>
                prev.map((conv) => {
                  if (conv.id === convId) {
                    return {
                      ...conv,
                      messages: conv.messages.map((msg) =>
                        msg.id === assistantMessageId ? { ...msg, reasoningLabel: chunk.data || "Thinking..." } : msg
                      ),
                    }
                  }
                  return conv
                })
              )
          } else if (chunk.type === 'reasoning_start') {
            setProcessingStatus('Reasoning...')
            currentReasoning = ''
          } else if (chunk.type === 'reasoning') {
            // Accumulate reasoning/thinking content
            if (chunk.data) {
              currentReasoning += chunk.data
              setConversations((prev) =>
                prev.map((conv) => {
                  if (conv.id === convId) {
                    return {
                      ...conv,
                      messages: conv.messages.map((msg) =>
                        msg.id === assistantMessageId ? { ...msg, reasoning: currentReasoning } : msg
                      ),
                    }
                  }
                  return conv
                })
              )
            }
          } else if (chunk.type === 'step') {
            if (chunk.data) {
              setConversations((prev) =>
                prev.map((conv) => {
                  if (conv.id === convId) {
                    return {
                      ...conv,
                      messages: conv.messages.map((msg) =>
                        msg.id === assistantMessageId ? { ...msg, steps: [...msg.steps ?? [], chunk.data ?? ""] } : msg
                      ),
                    }
                  }
                  return conv
                })
              )
            }
          } else if (chunk.type === 'reasoning_end') {
            // Reasoning complete, content will follow
            continue
          } else if (chunk.type === 'content') {
            // Clear processing status when content starts
            setProcessingStatus(null)
            // Append content chunk to assistant message
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id === convId) {
                  return {
                    ...conv,
                    messages: conv.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + (chunk.data || '') }
                        : msg
                    ),
                  }
                }
                return conv
              })
            )
          } else if (chunk.type === 'done') {
            // Mark streaming as complete
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id === convId) {
                  return {
                    ...conv,
                    messages: conv.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, isStreaming: false }
                        : msg
                    ),
                  }
                }
                return conv
              })
            )
          } else if (chunk.type === 'error') {
            if(chunk.data?.toLowerCase().includes('authentication required')) {
              await refreshOTCSToken();
              setConversations((prev) =>
                prev.map((conv) => {
                  if (conv.id === convId) {
                    return {
                      ...conv,
                      messages: conv.messages.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: 'Sorry, an error occurred. Please try again.', isStreaming: false }
                          : msg
                      ),
                    }
                  }
                  return conv
                })
              )
              break;
            }
            // Handle error
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id === convId) {
                  return {
                    ...conv,
                    messages: conv.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            content: `Error: ${chunk.data || 'An error occurred'}`,
                            isStreaming: false,
                          }
                        : msg
                    ),
                  }
                }
                return conv
              })
            )
          }
        }
      } catch (error) {
        console.error('Streaming error:', error)
        // Update message to show error state
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === convId) {
              return {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: 'Sorry, an error occurred. Please try again.', isStreaming: false }
                    : msg
                ),
              }
            }
            return conv
          })
        )
      } finally {
        setIsLoading(false)
        setProcessingStatus(null)
        // Ensure streaming flag is cleared
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === convId) {
              return {
                ...conv,
                messages: conv.messages.map((msg) =>
                  msg.id === assistantMessageId && msg.isStreaming ? { ...msg, isStreaming: false } : msg
                ),
              }
            }
            return conv
          })
        )
      }
    },
    [activeConversationId, conversations]
  )

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      handleSend(suggestion)
    },
    [handleSend]
  )

  const handleRegenerate = useCallback(
    (messageIndex: number) => {
      if (!activeConversationId || isLoading) return

      // Find the user message before this assistant message
      const conv = conversations.find((c) => c.id === activeConversationId)
      if (!conv) return

      // Find the previous user message
      let userMessageIndex = messageIndex - 1
      while (userMessageIndex >= 0 && conv.messages[userMessageIndex].role !== 'user') {
        userMessageIndex--
      }

      if (userMessageIndex < 0) return

      const userMessage = conv.messages[userMessageIndex]

      // Remove messages from userMessageIndex onwards
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConversationId) {
            return {
              ...c,
              messages: c.messages.slice(0, userMessageIndex),
              updatedAt: new Date(),
            }
          }
          return c
        })
      )

      // Re-send the user message
      setTimeout(() => handleSend(userMessage.content), 100)
    },
    [activeConversationId, conversations, isLoading, handleSend]
  )

  const handleEditMessage = useCallback(
    (messageIndex: number, newContent: string) => {
      if (!activeConversationId || isLoading) return

      const conv = conversations.find((c) => c.id === activeConversationId)
      if (!conv) return

      // Remove messages from this index onwards
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConversationId) {
            return {
              ...c,
              messages: c.messages.slice(0, messageIndex),
              updatedAt: new Date(),
            }
          }
          return c
        })
      )

      // Send the edited message
      setTimeout(() => handleSend(newContent), 100)
    },
    [activeConversationId, conversations, isLoading, handleSend]
  )

  const handleExportMarkdown = useCallback(() => {
    if (!activeConversation || messages.length === 0) return

    const formatTime = (date: Date) => {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date)
    }

    // Build markdown content
    let markdown = `# ${activeConversation.title}\n\n`
    markdown += `**Exported:** ${formatTime(new Date())}\n`
    markdown += `**Created:** ${formatTime(activeConversation.createdAt)}\n\n`
    markdown += `---\n\n`

    messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'You' : 'Assistant'
      const timestamp = formatTime(msg.timestamp)

      markdown += `### ${role}\n`
      markdown += `*${timestamp}*\n\n`

      if (msg.reasoning) {
        markdown += `<details>\n<summary>Thinking</summary>\n\n${msg.reasoning}\n\n</details>\n\n`
      }

      markdown += `${msg.content}\n\n`
      markdown += `---\n\n`
    })

    // Create and download file
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeConversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [activeConversation, messages])

  return (
    <div
      className="chat-layout"
    >
      <Sidebar
        user={user}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={async (id) => {
          setActiveConversationId(id)
          setActiveSessionId(id)
          window.history.pushState({ sessionId: id }, '', constructLink(`/rag/${id}`))
          // Fetch full chat history for the selected conversation
          try {
            const result = await getRAGConversationById(Number(id))
            if (result?.data) {
              const chats = result.data
              const messages: Message[] = chats.data.map((chat) => ({
                id: String(chat.id),
                content: chat.message,
                role: chat.type as 'user' | 'assistant',
                timestamp: new Date(chat.createdAt),
                reasoning: chat.reasoning || undefined,
                reasoningLabel: chat.reasoning ? 'Finished.' : undefined,
                steps: chat.steps?.length ? chat.steps.map((s) => s.message) : undefined,
              })).reverse()
              setConversations((prev) =>
                prev.map((c) => (c.id === id ? { ...c, messages } : c))
              )
            }
          } catch (error) {
            console.error('Failed to load conversation chats:', error)
          }
        }}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={() => auth.logout()}
        isLoading={isLoadingConversations}
      />

      <div className={`chat-main ${sidebarOpen ? '' : 'chat-main-expanded'}`}>
        <header className="chat-header">
          <h1>{activeConversation?.title || 'New chat'}</h1>
          <div className="chat-header-actions">
            {messages.length > 0 && (
              <button
                className="chat-header-action"
                onClick={handleExportMarkdown}
                aria-label="Export to Markdown"
                title="Export to Markdown"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            )}
            <button
              className="chat-header-action"
              onClick={() => setShowShortcuts(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
              </svg>
            </button>
          </div>
        </header>

        <main className="chat-messages">
          <div className="chat-messages-inner">
            <MessageList
              messages={messages}
              isLoading={isLoading}
              processingStatus={processingStatus}
              onSuggestionClick={handleSuggestionClick}
              onRegenerate={handleRegenerate}
              onEditMessage={handleEditMessage}
            />
          </div>
        </main>

        <div className="chat-input-wrapper">
          <ChatWithRAGInput
            ref={chatInputRef}
            onSend={handleSend}
            disabled={isLoading || false}
            isLoading={isLoading}
            isUploading={false}
            onStop={handleStop}
            attachments={[]}
            onRemoveAttachment={() => {}}
            onAddFiles={() => {}}
          />
        </div>
      </div>

      <KeyboardShortcuts
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  )
}
