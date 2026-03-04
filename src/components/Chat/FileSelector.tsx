import { useState, useEffect, useRef, useCallback } from 'react'
import { listWorkspaceFiles, searchWorkspaceFiles, type WorkspaceFile } from '../../services/documents'

interface FileSelectorProps {
  selectedFiles: WorkspaceFile[]
  onSelectionChange: (files: WorkspaceFile[]) => void
  disabled?: boolean
}

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileSelector({ selectedFiles, onSelectionChange, disabled }: FileSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalFiles, setTotalFiles] = useState(0)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load files (initial or paginated)
  const loadFiles = useCallback(async (page: number, query: string, append: boolean = false) => {
    if (page === 1) {
      setIsLoading(true)
    } else {
      setIsLoadingMore(true)
    }

    try {
      const response = query
        ? await searchWorkspaceFiles(query, page, PAGE_SIZE)
        : await listWorkspaceFiles(page, PAGE_SIZE)

      const newFiles = response.files || []
      const total = response.pagination?.total ?? response.total ?? 0

      if (append) {
        setFiles(prev => [...prev, ...newFiles])
      } else {
        setFiles(newFiles)
      }

      setTotalFiles(total)
      setCurrentPage(page)
      setHasMore(page * PAGE_SIZE < total)
    } catch (err) {
      console.error('Failed to load files:', err)
      if (!append) {
        setFiles([])
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  // Load initial files when dropdown opens
  useEffect(() => {
    if (isOpen && files.length === 0 && !isLoading) {
      loadFiles(1, '')
    }
  }, [isOpen, files.length, isLoading, loadFiles])

  // Handle search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (isOpen) {
        setCurrentPage(1)
        setHasMore(true)
        loadFiles(1, searchQuery)
      }
    }, searchQuery ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, isOpen, loadFiles])

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!listRef.current || isLoading || isLoadingMore || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    const scrollThreshold = 50

    if (scrollHeight - scrollTop - clientHeight < scrollThreshold) {
      loadFiles(currentPage + 1, searchQuery, true)
    }
  }, [isLoading, isLoadingMore, hasMore, currentPage, searchQuery, loadFiles])

  // Attach scroll listener
  useEffect(() => {
    const listElement = listRef.current
    if (listElement && isOpen) {
      listElement.addEventListener('scroll', handleScroll)
      return () => listElement.removeEventListener('scroll', handleScroll)
    }
  }, [isOpen, handleScroll])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Reset state when closing
  const handleToggle = () => {
    if (isOpen) {
      // Closing - reset search
      setSearchQuery('')
    }
    setIsOpen(!isOpen)
  }

  const toggleFile = (file: WorkspaceFile) => {
    const isSelected = selectedFiles.some(f => f.jobId === file.jobId)
    if (isSelected) {
      onSelectionChange(selectedFiles.filter(f => f.jobId !== file.jobId))
    } else {
      onSelectionChange([...selectedFiles, file])
    }
  }

  const handleRefresh = () => {
    setCurrentPage(1)
    setHasMore(true)
    loadFiles(1, searchQuery)
  }

  return (
    <div className="file-selector" ref={dropdownRef}>
      {/* Dropdown trigger */}
      <button
        type="button"
        className={`file-selector-trigger ${isOpen ? 'open' : ''} ${selectedFiles.length > 0 ? 'has-selection' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        title="Select files to ask about"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        {selectedFiles.length > 0 && (
          <span className="file-selector-count">{selectedFiles.length}</span>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="file-selector-dropdown">
          <div className="file-selector-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="file-selector-search-clear"
                onClick={() => setSearchQuery('')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <div className="file-selector-list" ref={listRef}>
            {isLoading ? (
              <div className="file-selector-loading">
                <div className="file-selector-spinner" />
                Loading...
              </div>
            ) : files.length === 0 ? (
              <div className="file-selector-empty">
                {searchQuery ? 'No files found' : 'No files uploaded'}
              </div>
            ) : (
              <>
                {files.map(file => {
                  const isSelected = selectedFiles.some(f => f.jobId === file.jobId)
                  // Chat API requires nodeId - jobId is not accepted
                  const hasNodeId = !!(file.nodeId || file.aliasId)
                  // If status is missing, assume file is ready (API may not return status)
                  const isCompleted = !file.status || ['completed', 'success', 'done', 'ready'].includes(file.status?.toLowerCase() || '')
                  // File is selectable only if it has nodeId and is completed
                  const isSelectable = hasNodeId && isCompleted
                  return (
                    <div
                      key={file.jobId}
                      className={`file-selector-item ${isSelected ? 'selected' : ''} ${!isSelectable ? 'not-ready' : ''}`}
                      onClick={() => isSelectable && toggleFile(file)}
                      title={!hasNodeId ? 'File not indexed yet' : !isCompleted ? `File is ${file.status}` : file.fileName}
                    >
                      <div className="file-selector-checkbox">
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div className="file-selector-file-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="file-selector-file-info">
                        <span className="file-selector-file-name">{file.fileName}</span>
                        <span className="file-selector-file-meta">{formatFileSize(file.fileSize)}</span>
                      </div>
                      {isCompleted ? (
                        <div className="file-selector-file-status completed">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      ) : (
                        <div className="file-selector-file-status processing">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )
                })}
                {isLoadingMore && (
                  <div className="file-selector-loading-more">
                    <div className="file-selector-spinner" />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="file-selector-footer">
            <button
              type="button"
              className="file-selector-refresh"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh
            </button>
            <span className="file-selector-total">
              {totalFiles} file{totalFiles !== 1 ? 's' : ''}
            </span>
            {selectedFiles.length > 0 && (
              <button
                type="button"
                className="file-selector-clear"
                onClick={() => onSelectionChange([])}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
