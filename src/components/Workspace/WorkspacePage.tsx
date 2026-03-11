import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react'
import {
  listWorkspaceFiles,
  deleteWorkspaceFile,
  uploadDocument,
  getJobStatus,
  getPendingJobs,
  addPendingJob,
  removePendingJob,
  getGraphViewerUrl,
  type WorkspaceFile,
  type UploadProgress,
  type PendingJob,
} from '../../services/documents'
import './WorkspacePage.css'
import { constructLink } from '../../utils/construct_link'
import { generateUUID } from '../../utils/uuid'

interface UploadingFile {
  id: string
  name: string
  size: number
  progress: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
}

interface ProcessingJob {
  jobId: string
  fileName: string
  fileSize: number
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress: number
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE'
  return ext.length > 4 ? 'FILE' : ext
}

const PAGE_SIZE = 20

export function WorkspacePage() {
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [filteredFiles, setFilteredFiles] = useState<WorkspaceFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalFiles, setTotalFiles] = useState(0)
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE)

  // Upload state
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // Processing jobs state (tracking document processing after upload)
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([])
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentPageRef = useRef(currentPage)

  // Keep ref in sync with state
  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  const loadFiles = useCallback(async (page: number = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await listWorkspaceFiles(page, PAGE_SIZE)
      setFiles(response.files || [])
      // Handle both top-level and nested pagination response
      const total = response.pagination?.total ?? response.total ?? 0
      setTotalFiles(total)
      setCurrentPage(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files')
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFiles(1)
  }, [loadFiles])

  // Poll job status for processing jobs
  const pollJobStatus = useCallback(async () => {
    const pendingJobs = getPendingJobs()
    if (pendingJobs.length === 0) return

    let shouldRefresh = false

    for (const job of pendingJobs) {
      try {
        const status = await getJobStatus(job.jobId)

        setProcessingJobs((prev) => {
          const existing = prev.find((j) => j.jobId === job.jobId)
          if (existing) {
            return prev.map((j) =>
              j.jobId === job.jobId
                ? { ...j, status: status.status, progress: status.progress }
                : j
            )
          } else {
            return [
              ...prev,
              {
                jobId: job.jobId,
                fileName: job.fileName,
                fileSize: job.fileSize,
                status: status.status,
                progress: status.progress,
              },
            ]
          }
        })

        // Remove completed or failed jobs
        if (status.status === 'completed' || status.status === 'failed') {
          removePendingJob(job.jobId)
          shouldRefresh = true

          // Remove from UI after a delay
          setTimeout(() => {
            setProcessingJobs((prev) => prev.filter((j) => j.jobId !== job.jobId))
          }, 3000)
        }
      } catch (err) {
        console.error('[WorkspacePage] Failed to get job status:', job.jobId, err)
        // Remove job if it can't be found (404)
        removePendingJob(job.jobId)
        setProcessingJobs((prev) => prev.filter((j) => j.jobId !== job.jobId))
      }
    }

    if (shouldRefresh) {
      loadFiles(currentPageRef.current)
    }
  }, [loadFiles])

  // Load pending jobs on mount and start polling
  useEffect(() => {
    const pendingJobs = getPendingJobs()

    if (pendingJobs.length > 0) {
      // Initialize processing jobs from localStorage
      setProcessingJobs(
        pendingJobs.map((job) => ({
          jobId: job.jobId,
          fileName: job.fileName,
          fileSize: job.fileSize,
          status: 'active' as const,
          progress: 0,
        }))
      )
      // Immediately poll to get current status
      pollJobStatus()
    }

    // Start polling interval (every 5 seconds)
    pollingIntervalRef.current = setInterval(() => {
      pollJobStatus()
    }, 5000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, []) // Empty deps - only run on mount

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      loadFiles(page)
      setSelectedFiles(new Set())
    }
  }

  // Upload handlers
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    // Convert to array before resetting input (resetting clears the FileList)
    const files = Array.from(fileList)

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    uploadFilesArray(files)
  }

  const removeUploadEntry = (id: string) => {
    setUploadingFiles((prev) => prev.filter((u) => u.id !== id))
  }

  // Upload files (shared logic for both file input and drag & drop)
  const uploadFilesArray = async (files: File[]) => {
    if (files.length === 0) return

    const newUploads: UploadingFile[] = files.map((file) => ({
      id: generateUUID(),
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading' as const,
    }))

    setUploadingFiles((prev) => [...prev, ...newUploads])

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const uploadEntry = newUploads[i]

      try {
        const response = await uploadDocument(file, (progress: UploadProgress) => {
          setUploadingFiles((prev) =>
            prev.map((u) =>
              u.id === uploadEntry.id ? { ...u, progress: progress.percent } : u
            )
          )
        })

        // Upload complete - now track processing status
        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.id === uploadEntry.id ? { ...u, status: 'completed', progress: 100 } : u
          )
        )

        // Remove upload entry after short delay
        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((u) => u.id !== uploadEntry.id))
        }, 1500)

        // Add to pending jobs for processing tracking
        if (response.jobId) {
          const pendingJob: PendingJob = {
            jobId: response.jobId,
            fileName: file.name,
            fileSize: file.size,
            createdAt: Date.now(),
          }
          addPendingJob(pendingJob)

          // Add to processing jobs UI
          setProcessingJobs((prev) => [
            ...prev,
            {
              jobId: response.jobId,
              fileName: file.name,
              fileSize: file.size,
              status: 'waiting',
              progress: 0,
            },
          ])
        }

      } catch (err) {
        setUploadingFiles((prev) =>
          prev.map((u) =>
            u.id === uploadEntry.id
              ? { ...u, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
              : u
          )
        )
      }
    }

    // Refresh file list and trigger immediate poll
    loadFiles(1)
    pollJobStatus()
  }

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFilesArray(Array.from(e.dataTransfer.files))
    }
  }

  // Filter and sort files
  useEffect(() => {
    let result = [...files]

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((file) =>
        file.fileName.toLowerCase().includes(query)
      )
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.fileName.localeCompare(b.fileName)
          break
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'size':
          comparison = a.fileSize - b.fileSize
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    setFilteredFiles(result)
  }, [files, searchQuery, sortBy, sortOrder])

  const handleDelete = async (fileId: string) => {
    if (confirmDeleteId === fileId) {
      try {
        await deleteWorkspaceFile(fileId)
        setFiles((prev) => prev.filter((f) => f.jobId !== fileId))
        setConfirmDeleteId(null)
        setSelectedFiles((prev) => {
          const next = new Set(prev)
          next.delete(fileId)
          return next
        })
      } catch (err) {
        console.error('Failed to delete file:', err)
      }
    } else {
      setConfirmDeleteId(fileId)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return

    for (const fileId of selectedFiles) {
      try {
        await deleteWorkspaceFile(fileId)
        setFiles((prev) => prev.filter((f) => f.jobId !== fileId))
      } catch (err) {
        console.error('Failed to delete file:', fileId, err)
      }
    }
    setSelectedFiles(new Set())
  }

  const toggleSelectFile = (fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(filteredFiles.map((f) => f.jobId)))
    }
  }

  const handleSort = (field: 'name' | 'date' | 'size') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const navigateToChat = () => {
    window.location.href = constructLink("/chatbot")
  }

  // Reset confirm state when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setConfirmDeleteId(null)
    if (confirmDeleteId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [confirmDeleteId])

  return (
    <div
      className="workspace-page"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className="workspace-drop-overlay">
          <div className="workspace-drop-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop files to upload</span>
          </div>
        </div>
      )}

      <header className="workspace-header">
        <div className="workspace-header-left">
          <button className="workspace-back-button" onClick={navigateToChat}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1>Workspace Files</h1>
        </div>
        <div className="workspace-header-right">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            className="workspace-kg-button"
            onClick={() => window.open(getGraphViewerUrl(), '_blank')}
            title="View entire workspace knowledge graph"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="2.5" />
              <circle cx="5" cy="19" r="2.5" />
              <circle cx="19" cy="19" r="2.5" />
              <line x1="12" y1="7.5" x2="5" y2="16.5" />
              <line x1="12" y1="7.5" x2="19" y2="16.5" />
              <line x1="7.5" y1="19" x2="16.5" y2="19" />
            </svg>
            <span>Knowledge Graph</span>
          </button>
          <button className="workspace-upload-button" onClick={handleUploadClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Upload Files</span>
          </button>
          <button className="workspace-refresh-button" onClick={() => loadFiles(currentPage)} disabled={isLoading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </header>

      {/* Upload progress */}
      {uploadingFiles.length > 0 && (
        <div className="workspace-uploads">
          {uploadingFiles.map((upload) => (
            <div key={upload.id} className={`workspace-upload-item ${upload.status}`}>
              <div className="workspace-upload-icon">
                {upload.status === 'uploading' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                )}
                {upload.status === 'completed' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {upload.status === 'error' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
              </div>
              <div className="workspace-upload-info">
                <span className="workspace-upload-name">{upload.name}</span>
                {upload.status === 'uploading' && (
                  <div className="workspace-upload-progress">
                    <div className="workspace-upload-progress-bar" style={{ width: `${upload.progress}%` }} />
                  </div>
                )}
                {upload.status === 'error' && (
                  <span className="workspace-upload-error">{upload.error}</span>
                )}
              </div>
              {upload.status === 'error' && (
                <button className="workspace-upload-dismiss" onClick={() => removeUploadEntry(upload.id)}>
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

      {/* Processing jobs progress */}
      {processingJobs.length > 0 && (
        <div className="workspace-processing">
          {processingJobs.map((job) => (
            <div key={job.jobId} className={`workspace-processing-item ${job.status}`}>
              <div className="workspace-processing-icon">
                {(job.status === 'waiting' || job.status === 'active' || job.status === 'delayed') && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                )}
                {job.status === 'completed' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {job.status === 'failed' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
              </div>
              <div className="workspace-processing-info">
                <div className="workspace-processing-header">
                  <span className="workspace-processing-name">{job.fileName}</span>
                  <span className="workspace-processing-status">
                    {job.status === 'waiting' && 'Queued'}
                    {job.status === 'active' && 'Processing'}
                    {job.status === 'delayed' && 'Delayed'}
                    {job.status === 'completed' && 'Complete'}
                    {job.status === 'failed' && 'Failed'}
                  </span>
                </div>
                {(job.status === 'waiting' || job.status === 'active' || job.status === 'delayed') && (
                  <div className="workspace-processing-progress">
                    <div
                      className="workspace-processing-progress-bar"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
                {job.status === 'active' && job.progress > 0 && (
                  <span className="workspace-processing-percent">{job.progress}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="workspace-toolbar">
        <div className="workspace-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="workspace-search-clear" onClick={() => setSearchQuery('')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {selectedFiles.size > 0 && (
          <div className="workspace-bulk-actions">
            <span>{selectedFiles.size} selected</span>
            <button className="workspace-bulk-delete" onClick={handleBulkDelete}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="workspace-content">
        {isLoading ? (
          <div className="workspace-loading">
            <div className="workspace-spinner" />
            <span>Loading files...</span>
          </div>
        ) : error ? (
          <div className="workspace-error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h2>Failed to load files</h2>
            <p>{error}</p>
            <button onClick={() => loadFiles(1)}>Try again</button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="workspace-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <h2>{searchQuery ? 'No files found' : 'No files uploaded'}</h2>
            <p>{searchQuery ? 'Try a different search term' : 'Upload files from the chat to see them here'}</p>
            {!searchQuery && (
              <button onClick={navigateToChat}>Go to Chat</button>
            )}
          </div>
        ) : (
          <div className="workspace-table-container">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th className="workspace-table-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="workspace-table-name" onClick={() => handleSort('name')}>
                    Name
                    {sortBy === 'name' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {sortOrder === 'asc' ? (
                          <polyline points="18 15 12 9 6 15" />
                        ) : (
                          <polyline points="6 9 12 15 18 9" />
                        )}
                      </svg>
                    )}
                  </th>
                  <th className="workspace-table-status">Status</th>
                  <th className="workspace-table-size" onClick={() => handleSort('size')}>
                    Size
                    {sortBy === 'size' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {sortOrder === 'asc' ? (
                          <polyline points="18 15 12 9 6 15" />
                        ) : (
                          <polyline points="6 9 12 15 18 9" />
                        )}
                      </svg>
                    )}
                  </th>
                  <th className="workspace-table-date" onClick={() => handleSort('date')}>
                    Uploaded
                    {sortBy === 'date' && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {sortOrder === 'asc' ? (
                          <polyline points="18 15 12 9 6 15" />
                        ) : (
                          <polyline points="6 9 12 15 18 9" />
                        )}
                      </svg>
                    )}
                  </th>
                  <th className="workspace-table-actions"></th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.jobId} className={selectedFiles.has(file.jobId) ? 'selected' : ''}>
                    <td className="workspace-table-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.jobId)}
                        onChange={() => toggleSelectFile(file.jobId)}
                      />
                    </td>
                    <td className="workspace-table-name">
                      <div className="workspace-file-name-cell">
                        <div className="workspace-file-ext">{getFileExtension(file.fileName)}</div>
                        <span>{file.fileName}</span>
                      </div>
                    </td>
                    <td className="workspace-table-status">
                      {(() => {
                        const status = file.status || 'completed'
                        return (
                          <span className={`workspace-status-badge ${status}`}>
                            {status === 'completed' && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                            {(status === 'queued' || status === 'processing') && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                              </svg>
                            )}
                            {status}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="workspace-table-size">{formatFileSize(file.fileSize)}</td>
                    <td className="workspace-table-date">{formatDate(file.createdAt)}</td>
                    <td className="workspace-table-actions">
                      <div className="workspace-table-actions-inner">
                        <button
                          className="workspace-graph-button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const nodeId = file.nodeId || file.aliasId
                            const url = getGraphViewerUrl(nodeId)
                            window.open(url, '_blank')
                          }}
                          title="View Knowledge Graph"
                          disabled={!file.nodeId && !file.aliasId}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="5" r="2.5" />
                            <circle cx="5" cy="19" r="2.5" />
                            <circle cx="19" cy="19" r="2.5" />
                            <line x1="12" y1="7.5" x2="5" y2="16.5" />
                            <line x1="12" y1="7.5" x2="19" y2="16.5" />
                            <line x1="7.5" y1="19" x2="16.5" y2="19" />
                          </svg>
                        </button>
                        <button
                          className={`workspace-delete-button ${confirmDeleteId === file.jobId ? 'confirm' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(file.jobId)
                          }}
                          title="Delete file"
                        >
                          {confirmDeleteId === file.jobId ? (
                            'Confirm'
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer className="workspace-footer">
        <span className="workspace-footer-count">
          {searchQuery
            ? `${filteredFiles.length} of ${files.length} on this page`
            : `${totalFiles} file${totalFiles !== 1 ? 's' : ''}`
          }
        </span>

        {totalPages > 1 && (
          <div className="workspace-pagination">
            <button
              className="workspace-pagination-btn"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1 || isLoading}
              title="First page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
            </button>
            <button
              className="workspace-pagination-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              title="Previous page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <span className="workspace-pagination-info">
              Page {currentPage} of {totalPages}
            </span>

            <button
              className="workspace-pagination-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
              title="Next page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button
              className="workspace-pagination-btn"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages || isLoading}
              title="Last page"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
