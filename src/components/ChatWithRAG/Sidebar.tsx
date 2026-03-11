import { useState, useEffect, useMemo, useRef } from 'react'
import type { Conversation } from '../../types/chat'
import { UserProfile } from '../ui/UserProfile'
import { ConversationSkeleton } from '../ui/Skeleton'
import { UserInfo } from '../../services/auth'

interface SidebarProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewChat: () => void
  onDeleteConversation: (id: string) => void
  onRenameConversation: (id: string, newName: string) => void
  isOpen: boolean
  onToggle: () => void
  user?: UserInfo | null
  onLogout?: () => void
  isLoading?: boolean
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  isOpen,
  onToggle,
  user,
  onLogout,
  isLoading = false,
}: SidebarProps) {
  // Track which conversation is in "confirm delete" state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const query = searchQuery.toLowerCase()
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(query)
    )
  }, [conversations, searchQuery])

  // Reset confirm state when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setConfirmDeleteId(null)
    }
    if (confirmDeleteId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [confirmDeleteId])

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation()
    if (confirmDeleteId === conversationId) {
      // Second click - actually delete
      onDeleteConversation(conversationId)
      setConfirmDeleteId(null)
    } else {
      // First click - show confirm state
      setConfirmDeleteId(conversationId)
    }
  }

  const handleStartRename = (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation()
    setEditingId(conversation.id)
    setEditingName(conversation.title)
    setConfirmDeleteId(null)
  }

  const handleRenameSubmit = (id: string) => {
    const trimmed = editingName.trim()
    if (trimmed && trimmed !== conversations.find((c) => c.id === id)?.title) {
      onRenameConversation(id, trimmed)
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSubmit(id)
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditingName('')
    }
  }

  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingId])

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Group conversations by date
  const groupedConversations = filteredConversations.reduce((groups, conv) => {
    const dateKey = formatDate(conv.createdAt)
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    groups[dateKey].push(conv)
    return groups
  }, {} as Record<string, Conversation[]>)

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-header">
          <button className="new-chat-button" onClick={onNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New chat</span>
          </button>
          <button className="sidebar-toggle" onClick={onToggle} aria-label="Close sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        <div className="sidebar-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="sidebar-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {isLoading ? (
            <div className="conversation-group">
              <ConversationSkeleton />
              <ConversationSkeleton />
              <ConversationSkeleton />
              <ConversationSkeleton />
            </div>
          ) : (
            <>
              {Object.entries(groupedConversations).map(([dateLabel, convs]) => (
                <div key={dateLabel} className="conversation-group">
                  <h3 className="conversation-group-label">{dateLabel}</h3>
                  {convs.filter((c) => c.id).map((conversation, index) => (
                    <div
                      key={conversation.id || `conv-${index}`}
                      className={`conversation-item ${
                        conversation.id === activeConversationId ? 'active' : ''
                      }`}
                      onClick={() => editingId !== conversation.id && onSelectConversation(conversation.id)}
                      onDoubleClick={(e) => handleStartRename(e, conversation)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelectConversation(conversation.id)
                        }
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {editingId === conversation.id ? (
                        <input
                          ref={renameInputRef}
                          className="conversation-rename-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => handleRenameKeyDown(e, conversation.id)}
                          onBlur={() => handleRenameSubmit(conversation.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="conversation-title">{conversation.title}</span>
                      )}
                      {editingId !== conversation.id && (
                        <>
                          <button
                            className="conversation-rename"
                            onClick={(e) => handleStartRename(e, conversation)}
                            aria-label="Rename conversation"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className={`conversation-delete ${confirmDeleteId === conversation.id ? 'confirm' : ''}`}
                            onClick={(e) => handleDeleteClick(e, conversation.id)}
                            aria-label={confirmDeleteId === conversation.id ? 'Confirm delete' : 'Delete conversation'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            {confirmDeleteId === conversation.id && <span>Delete</span>}
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {filteredConversations.length === 0 && (
                <div className="sidebar-empty">
                  {searchQuery ? (
                    <>
                      <p>No matches found</p>
                      <p>Try a different search term</p>
                    </>
                  ) : (
                    <>
                      <p>No conversations yet</p>
                      <p>Start a new chat to begin</p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <a href="/workspace" className="workspace-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Workspace Files</span>
          </a>
          <UserProfile
            name={user?.name || 'Guest'}
            email={user?.email || ''}
            avatarUrl={''}
            onLogout={onLogout || (() => {})}
          />
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}

      {/* Toggle button when sidebar is closed */}
      {!isOpen && (
        <button className="sidebar-open-button" onClick={onToggle} aria-label="Open sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      )}
    </>
  )
}
