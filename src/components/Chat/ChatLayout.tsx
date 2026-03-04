import { useState, useCallback, useEffect, useRef, DragEvent } from 'react'
import type { Message, Conversation, Attachment } from '../../types/chat'
import { streamChat } from '../../services/chat'
import { uploadDocument } from '../../services/documents'
import {
  listConversations,
  createConversation,
  deleteConversation,
  getConversation,
  getActiveSessionId,
  setActiveSessionId,
} from '../../services/conversations'
import { Sidebar } from './Sidebar'
import { MessageList } from './MessageList'
import { ChatInput, ChatInputHandle } from './ChatInput'
import { KeyboardShortcuts } from '../ui/KeyboardShortcuts'
import './ChatLayout.css'
import './Chat.css'
import { useAuth } from '../../context/AuthContext'

export function ChatLayout() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null)
  const [conversationsLoading, setConversationsLoading] = useState(true)
  // Start with sidebar closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const auth = useAuth();

  // Ref to track if we should abort streaming
  const abortRef = useRef(false)

  // Get session ID from URL path (e.g., /chatbot/session-id)
  const getSessionIdFromUrl = useCallback(() => {
    const path = window.location.pathname
    const match = path.match(/\/chatbot\/([^/]+)/)
    return match ? match[1] : null
  }, [])

  // Load conversations from API on mount (auth already handled in App.tsx)
  useEffect(() => {
    async function loadConversations() {
      try {
        const loaded = await listConversations()
        setConversations(loaded)

        // Check URL for session ID first, then localStorage, then first conversation
        const urlSessionId = getSessionIdFromUrl()
        const savedActiveId = getActiveSessionId()
        const targetSessionId = urlSessionId || savedActiveId

        if (targetSessionId && loaded.some((c) => c.id === targetSessionId)) {
          setActiveConversationId(targetSessionId)
          setActiveSessionId(targetSessionId)
          // Update URL if it came from localStorage
          if (!urlSessionId) {
            window.history.replaceState({ sessionId: targetSessionId }, '', `/chatbot/${targetSessionId}`)
          }
          // Load full messages for the active conversation
          try {
            const fullConv = await getConversation(targetSessionId)
            if (fullConv) {
              setConversations((prev) =>
                prev.map((c) => (c.id === targetSessionId ? fullConv : c))
              )
            }
          } catch (err) {
            console.error('Failed to load active conversation:', err)
          }
        } else if (loaded.length > 0 && loaded[0].id) {
          setActiveConversationId(loaded[0].id)
          setActiveSessionId(loaded[0].id)
          window.history.replaceState({ sessionId: loaded[0].id }, '', `/chatbot/${loaded[0].id}`)
          // Load full messages for the first conversation
          try {
            const fullConv = await getConversation(loaded[0].id)
            if (fullConv) {
              setConversations((prev) =>
                prev.map((c) => (c.id === loaded[0].id ? fullConv : c))
              )
            }
          } catch (err) {
            console.error('Failed to load first conversation:', err)
          }
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
      } finally {
        setConversationsLoading(false)
      }
    }
    loadConversations()
  }, [getSessionIdFromUrl])

  // Ref for focusing chat input
  const chatInputRef = useRef<ChatInputHandle>(null)

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = async (event: PopStateEvent) => {
      const sessionId = event.state?.sessionId || getSessionIdFromUrl()
      if (sessionId && sessionId !== activeConversationId) {
        setActiveConversationId(sessionId)
        setActiveSessionId(sessionId)
        // Load full messages
        try {
          const fullConv = await getConversation(sessionId)
          if (fullConv) {
            setConversations((prev) => prev.map((c) => (c.id === sessionId ? fullConv : c)))
          }
        } catch (error) {
          console.error('Failed to load conversation:', error)
        }
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

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const newAttachments: Attachment[] = fileArray.map((file) => {
      const attachment: Attachment = {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      }

      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id ? { ...a, preview: e.target?.result as string } : a
            )
          )
        }
        reader.readAsDataURL(file)
      }

      return attachment
    })

    setAttachments((prev) => [...prev, ...newAttachments])
  }, [])

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        processFiles(files)
      }
    },
    [processFiles]
  )

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleNewChat = useCallback(async () => {
    try {
      const newConversation = await createConversation('New Conversation')
      setConversations((prev) => [newConversation, ...prev])
      setActiveConversationId(newConversation.id)
      setActiveSessionId(newConversation.id)
      // Update URL
      window.history.pushState({ sessionId: newConversation.id }, '', `/chatbot/${newConversation.id}`)
    } catch (error) {
      console.error('Failed to create conversation:', error)
      // Fallback to local-only conversation
      const fallbackConversation: Conversation = {
        id: crypto.randomUUID(),
        title: 'New conversation',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setConversations((prev) => [fallbackConversation, ...prev])
      setActiveConversationId(fallbackConversation.id)
      window.history.pushState({ sessionId: fallbackConversation.id }, '', `/chatbot/${fallbackConversation.id}`)
    }
  }, [])

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id)
    setActiveSessionId(id)

    // Update URL without page reload
    window.history.pushState({ sessionId: id }, '', `/chatbot/${id}`)

    // Load full messages for the selected conversation
    try {
      const fullConv = await getConversation(id)
      if (fullConv) {
        setConversations((prev) => prev.map((c) => (c.id === id ? fullConv : c)))
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }, [])

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id)
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

  const handleStop = useCallback(() => {
    abortRef.current = true
    setIsLoading(false)
    setProcessingStatus(null)
  }, [])

  const handleSend = useCallback(
    async (content: string, messageAttachments?: Attachment[], selectedFileNodeIds?: string[]) => {
      let convId = activeConversationId

      // Create new conversation if none active
      if (!convId) {
        try {
          const newConversation = await createConversation('New Conversation')
          setConversations((prev) => [newConversation, ...prev])
          convId = newConversation.id
          setActiveConversationId(convId)
          setActiveSessionId(convId)
        } catch (error) {
          console.error('Failed to create conversation:', error)
          return
        }
      }

      // Upload attachments to Document API if any
      let uploadedAttachments = messageAttachments || []
      // Start with selected file nodeIds (from workspace file selector)
      const documentNodeIds: string[] = [...(selectedFileNodeIds || [])]

      if (uploadedAttachments.length > 0) {
        setIsUploading(true)

        // Update attachments to show uploading status
        uploadedAttachments = uploadedAttachments.map((a) => ({
          ...a,
          uploadStatus: 'uploading' as const,
          uploadProgress: 0,
        }))
        setAttachments(uploadedAttachments)

        try {
          // Upload each file
          const uploadResults = await Promise.all(
            uploadedAttachments.map(async (attachment, index) => {
              try {
                const result = await uploadDocument(attachment.file, (progress) => {
                  setAttachments((prev) =>
                    prev.map((a, i) =>
                      i === index ? { ...a, uploadProgress: progress.percent } : a
                    )
                  )
                })
                return { attachment, result, error: null }
              } catch (error) {
                return { attachment, result: null, error: error as Error }
              }
            })
          )

          // Process results
          uploadedAttachments = uploadedAttachments.map((attachment, index) => {
            const uploadResult = uploadResults[index]
            if (uploadResult.result) {
              // nodeId is now guaranteed by documents.ts (uses aliasId or generates one)
              const nodeId = uploadResult.result.nodeId || uploadResult.result.aliasId
              if (nodeId) {
                documentNodeIds.push(nodeId)
              }
              return {
                ...attachment,
                uploadStatus: 'completed' as const,
                uploadProgress: 100,
                nodeId: uploadResult.result.nodeId,
                jobId: uploadResult.result.jobId,
              }
            } else {
              return {
                ...attachment,
                uploadStatus: 'error' as const,
                uploadError: uploadResult.error?.message || 'Upload failed',
              }
            }
          })

          // Check if any uploads failed
          const failedUploads = uploadedAttachments.filter((a) => a.uploadStatus === 'error')
          if (failedUploads.length > 0) {
            // Update attachments to show errors but don't block sending
            setAttachments(uploadedAttachments)
            console.error('Some uploads failed:', failedUploads.map((f) => f.uploadError))
          }
        } catch (error) {
          console.error('Upload error:', error)
          // Mark all as error
          uploadedAttachments = uploadedAttachments.map((a) => ({
            ...a,
            uploadStatus: 'error' as const,
            uploadError: 'Upload failed',
          }))
          setAttachments(uploadedAttachments)
        } finally {
          setIsUploading(false)
        }
      }

      // If no text content but has attachments, just upload files without sending chat
      if (!content && uploadedAttachments.length > 0) {
        // Keep attachments visible with their upload status so user can see them
        // and type a message about them
        setAttachments(uploadedAttachments)
        return
      }

      const userMessage: Message = {
        id: crypto.randomUUID(),
        content,
        role: 'user',
        timestamp: new Date(),
        attachments: uploadedAttachments,
      }

      // Clear attachments
      setAttachments([])

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
      const assistantMessageId = crypto.randomUUID()
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
        // Get current messages for context
        const currentConv = conversations.find((c) => c.id === convId)
        const contextMessages = [...(currentConv?.messages || []), userMessage]

        let currentReasoning = ''

        // Stream the response
        for await (const chunk of streamChat(convId, contextMessages, { documentNodeIds })) {
          // Check if user requested stop
          if (abortRef.current) {
            break
          }

          if (chunk.type === 'thinking') {
            setProcessingStatus(chunk.data || 'Thinking...')
            currentReasoning = ''
          } else if (chunk.type === 'query_rewritten') {
            setProcessingStatus('Optimizing query...')
          } else if (chunk.type === 'sources') {
            setProcessingStatus(`Found ${chunk.sources?.length || 0} relevant sources`)
          } else if (chunk.type === 'tool_call_start') {
            setProcessingStatus(`Using ${chunk.toolName || 'tool'}...`)
          } else if (chunk.type === 'tool_call_end') {
            setProcessingStatus(null)
          } else if (chunk.type === 'verification_start') {
            setProcessingStatus('Verifying facts...')
          } else if (chunk.type === 'verification_end') {
            setProcessingStatus(null)
          } else if (chunk.type === 'reasoning_start') {
            setProcessingStatus('Reasoning...')
            currentReasoning = ''
          } else if (chunk.type === 'reasoning') {
            // Accumulate reasoning/thinking content
            if (chunk.data) {
              currentReasoning += (currentReasoning ? '\n' : '') + chunk.data
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
          } else if (chunk.type === 'title') {
            // Update conversation title from API
            if (chunk.title) {
              setConversations((prev) =>
                prev.map((conv) => {
                  if (conv.id === convId) {
                    return { ...conv, title: chunk.title! }
                  }
                  return conv
                })
              )
            }
          } else if (chunk.type === 'done') {
            // Mark streaming as complete
            setConversations((prev) =>
              prev.map((conv) => {
                if (conv.id === convId) {
                  return {
                    ...conv,
                    messages: conv.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, isStreaming: false, tokensUsed: chunk.tokensUsed }
                        : msg
                    ),
                  }
                }
                return conv
              })
            )
          } else if (chunk.type === 'error') {
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
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop files to attach</span>
          </div>
        </div>
      )}

      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={() => auth.logout()}
        isLoading={conversationsLoading}
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
          <ChatInput
            ref={chatInputRef}
            onSend={handleSend}
            disabled={isLoading || isUploading}
            isLoading={isLoading}
            isUploading={isUploading}
            onStop={handleStop}
            attachments={attachments}
            onRemoveAttachment={handleRemoveAttachment}
            onAddFiles={(files) => processFiles(files)}
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
