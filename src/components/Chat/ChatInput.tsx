import { useState, useRef, useEffect, useImperativeHandle, forwardRef, FormEvent, KeyboardEvent, ChangeEvent } from 'react'
import type { Attachment } from '../../types/chat'
import { FileSelector } from './FileSelector'
import type { WorkspaceFile } from '../../services/documents'

interface ChatInputProps {
  onSend: (message: string, attachments?: Attachment[], selectedFileNodeIds?: string[]) => void
  disabled?: boolean
  isLoading?: boolean
  isUploading?: boolean
  onStop?: () => void
  attachments?: Attachment[]
  onRemoveAttachment?: (id: string) => void
  onAddFiles?: (files: FileList) => void
}

export interface ChatInputHandle {
  focus: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput(
  { onSend, disabled, isLoading, isUploading, onStop, attachments = [], onRemoveAttachment, onAddFiles },
  ref
) {
  const [input, setInput] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<WorkspaceFile[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus()
  }))

  const handleFileButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0 && onAddFiles) {
      onAddFiles(files)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  // Refocus textarea when it becomes enabled again
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus()
    }
  }, [disabled])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && attachments.length === 0 && selectedFiles.length === 0) || disabled) return

    // Get nodeIds from selected files (chat API only accepts nodeId/aliasId)
    const selectedFileNodeIds = selectedFiles
      .map(f => f.nodeId || f.aliasId)
      .filter((id): id is string => !!id)

    onSend(
      input.trim(),
      attachments.length > 0 ? attachments : undefined,
      selectedFileNodeIds.length > 0 ? selectedFileNodeIds : undefined
    )
    setInput('')
    setSelectedFiles([])

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Use setTimeout to ensure focus happens after button click completes
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      {attachments.length > 0 && (
        <div className="chat-attachments">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className={`chat-attachment ${attachment.uploadStatus === 'error' ? 'chat-attachment-error' : ''}`}
            >
              {attachment.uploadStatus === 'uploading' ? (
                <div className="chat-attachment-spinner">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                </div>
              ) : attachment.uploadStatus === 'completed' ? (
                <div className="chat-attachment-check">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : attachment.uploadStatus === 'error' ? (
                <div className="chat-attachment-error-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
              ) : attachment.preview ? (
                <img src={attachment.preview} alt={attachment.name} className="chat-attachment-preview" />
              ) : (
                <div className="chat-attachment-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
              )}
              <div className="chat-attachment-info">
                <span className="chat-attachment-name">{attachment.name}</span>
                {attachment.uploadStatus === 'uploading' ? (
                  <div className="chat-attachment-progress-wrapper">
                    <div className="chat-attachment-progress-bar-bg">
                      <div
                        className="chat-attachment-progress-bar-fill"
                        style={{ width: `${attachment.uploadProgress || 0}%` }}
                      />
                    </div>
                    <span className="chat-attachment-progress-text">{attachment.uploadProgress || 0}%</span>
                  </div>
                ) : attachment.uploadStatus === 'error' ? (
                  <span className="chat-attachment-error-text">{attachment.uploadError || 'Upload failed'}</span>
                ) : attachment.uploadStatus === 'completed' ? (
                  <span className="chat-attachment-uploaded">Uploaded</span>
                ) : (
                  <span className="chat-attachment-size">{formatFileSize(attachment.size)}</span>
                )}
              </div>
              {onRemoveAttachment && !isUploading && (
                <button
                  type="button"
                  className="chat-attachment-remove"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  aria-label="Remove attachment"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {selectedFiles.length > 0 && (
        <div className="chat-selected-files">
          {selectedFiles.map(file => (
            <div key={file.jobId} className="chat-selected-file">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="chat-selected-file-name">{file.fileName}</span>
              <button
                type="button"
                onClick={() => setSelectedFiles(selectedFiles.filter(f => f.jobId !== file.jobId))}
                aria-label="Remove file"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="chat-input-container">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="chat-input-attach"
          onClick={handleFileButtonClick}
          disabled={disabled}
          aria-label="Attach files"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <FileSelector
          selectedFiles={selectedFiles}
          onSelectionChange={setSelectedFiles}
          disabled={disabled}
        />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          disabled={disabled}
          rows={1}
          autoFocus
        />
        {isLoading ? (
          <button
            type="button"
            className="chat-input-stop"
            onClick={onStop}
            aria-label="Stop generating"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="chat-input-spinner" />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={(!input.trim() && attachments.length === 0 && selectedFiles.length === 0) || disabled}
            aria-label="Send message"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
      <p className="chat-input-hint">
        Press <kbd>Enter</kbd> to send, <kbd>Shift + Enter</kbd> for new line
      </p>
    </form>
  )
})
