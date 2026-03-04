import { useState, useEffect, useRef, useCallback } from 'react'
import { CSNode, getFolders } from '../../services/folders'

interface FileSelectorProps {
  selectedFiles: CSNode[]
  onSelectionChange: (files: CSNode[]) => void
  disabled?: boolean
}

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

export function FolderSelector({ selectedFiles, onSelectionChange, disabled }: FileSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [files, setFiles] = useState<CSNode[]>([])
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
      const response = await getFolders(query);
      const newFiles = response.data?.data || []
      const total = response.data?.totalRecords || 0

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

  const toggleFile = (file: CSNode) => {
    const isSelected = selectedFiles.some(f => f.dataID === file.dataID)
    if (isSelected) {
      onSelectionChange(selectedFiles.filter(f => f.dataID !== file.dataID))
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
        title="Select folder to ask about"
      >
        <svg fill='#64748b' width={28} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill='#64748b' d="M576 448C576 483.3 547.3 512 512 512L128 512C92.7 512 64 483.3 64 448L64 160C64 124.7 92.7 96 128 96L266.7 96C280.5 96 294 100.5 305.1 108.8L343.5 137.6C349 141.8 355.8 144 362.7 144L512 144C547.3 144 576 172.7 576 208L576 448zM320 224C306.7 224 296 234.7 296 248L296 296L248 296C234.7 296 224 306.7 224 320C224 333.3 234.7 344 248 344L296 344L296 392C296 405.3 306.7 416 320 416C333.3 416 344 405.3 344 392L344 344L392 344C405.3 344 416 333.3 416 320C416 306.7 405.3 296 392 296L344 296L344 248C344 234.7 333.3 224 320 224z"/></svg>
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
              placeholder="Search folder..."
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
                  const isSelected = selectedFiles.some(f => f.dataID === file.dataID)
                  return (
                    <div
                      key={file.dataID}
                      className={`file-selector-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleFile(file)}
                      title={file.name}
                    >
                      <div className="file-selector-checkbox">
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div style={{background: 'none'}} className="file-selector-file-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path fill='#64748b' d="M128 464L512 464C520.8 464 528 456.8 528 448L528 208C528 199.2 520.8 192 512 192L362.7 192C345.4 192 328.5 186.4 314.7 176L276.3 147.2C273.5 145.1 270.2 144 266.7 144L128 144C119.2 144 112 151.2 112 160L112 448C112 456.8 119.2 464 128 464zM512 512L128 512C92.7 512 64 483.3 64 448L64 160C64 124.7 92.7 96 128 96L266.7 96C280.5 96 294 100.5 305.1 108.8L343.5 137.6C349 141.8 355.8 144 362.7 144L512 144C547.3 144 576 172.7 576 208L576 448C576 483.3 547.3 512 512 512z"/></svg>
                      </div>
                      <div className="file-selector-file-info">
                        <span className="file-selector-file-name">{file.name}</span>
                      </div>
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
              {totalFiles} folder{totalFiles !== 1 ? 's' : ''}
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
