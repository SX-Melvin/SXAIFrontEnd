import { getAuthToken } from './api'

const API_BASE = import.meta.env.VITE_API_URL || ''
const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID || 'test'
const DEBUG = import.meta.env.VITE_DEBUG === 'true'

function debug(...args: unknown[]) {
  if (DEBUG) {
    console.log('[documents]', ...args)
  }
}

/**
 * Generate a nodeId from filename and timestamp
 */
async function generateNodeId(fileName: string): Promise<string> {
  const timestamp = Date.now()
  const data = `${fileName}-${timestamp}-${WORKSPACE_ID}`
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 32) // Return first 32 chars
}

export interface DocumentUploadResponse {
  jobId: string
  status: string
  fileName: string
  fileSize: number
  fileHash: string
  nodeId?: string
  aliasId?: string
  isAlias: boolean
}

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export class DocumentUploadError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'DocumentUploadError'
  }
}

/**
 * Upload a document to the Document API
 */
export async function uploadDocument(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<DocumentUploadResponse> {
  const url = `${API_BASE}/api/documents`

  const formData = new FormData()
  // Put workspaceId first - some parsers are order-sensitive
  formData.append('workspaceId', WORKSPACE_ID)
  formData.append('file', file)

  debug('Uploading document:', file.name, 'size:', file.size, 'workspaceId:', WORKSPACE_ID)
  debug('FormData entries:', Array.from(formData.entries()).map(([k, v]) => [k, v instanceof File ? v.name : v]))

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        })
      }
    })

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText) as DocumentUploadResponse
          // Generate nodeId if not provided by API
          if (!response.nodeId) {
            response.nodeId = response.aliasId || await generateNodeId(file.name)
          }
          debug('Upload successful:', response)
          resolve(response)
        } catch {
          reject(new DocumentUploadError(xhr.status, 'Invalid response from server'))
        }
      } else {
        let errorMessage = `Upload failed with status ${xhr.status}`
        try {
          const errorData = JSON.parse(xhr.responseText)
          debug('Upload error response:', errorData)
          if (errorData?.message) {
            errorMessage = errorData.message
          } else if (errorData?.error) {
            errorMessage = errorData.error
          }
        } catch {
          // Response body is not JSON
        }
        debug('Upload failed:', xhr.status, errorMessage)
        reject(new DocumentUploadError(xhr.status, errorMessage))
      }
    })

    xhr.addEventListener('error', () => {
      debug('Upload network error')
      reject(new DocumentUploadError(0, 'Network error during upload'))
    })

    xhr.addEventListener('abort', () => {
      debug('Upload aborted')
      reject(new DocumentUploadError(0, 'Upload was cancelled'))
    })

    xhr.open('POST', url)

    // Add auth header
    const token = getAuthToken()
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    xhr.send(formData)
  })
}

/**
 * Upload multiple documents in parallel
 */
export async function uploadDocuments(
  files: File[],
  onProgress?: (fileIndex: number, progress: UploadProgress) => void
): Promise<DocumentUploadResponse[]> {
  const uploadPromises = files.map((file, index) =>
    uploadDocument(file, (progress) => onProgress?.(index, progress))
  )

  return Promise.all(uploadPromises)
}

export interface WorkspaceFile {
  id: string
  jobId: string
  fileName: string
  fileSize: number
  fileHash: string
  status: string
  nodeId?: string
  aliasId?: string
  createdAt: string
  updatedAt: string
}

export interface ListFilesResponse {
  files: WorkspaceFile[]
  total: number
  page: number
  limit: number
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/**
 * List all files in the workspace
 */
export async function listWorkspaceFiles(
  page = 1,
  limit = 50
): Promise<ListFilesResponse> {
  const url = `${API_BASE}/api/workspaces/${WORKSPACE_ID}/files?page=${page}&limit=${limit}`

  debug('Fetching workspace files:', url)

  const headers: Record<string, string> = {}
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    let errorMessage = `Failed to list files with status ${response.status}`
    try {
      const errorData = await response.json()
      if (errorData?.message) {
        errorMessage = errorData.message
      }
    } catch {
      // Response body is not JSON
    }
    debug('List files failed:', response.status, errorMessage)
    throw new Error(errorMessage)
  }

  const result = await response.json()
  debug('List files successful:', result)
  return result
}

/**
 * Search files in the workspace by name or content
 */
export async function searchWorkspaceFiles(
  query: string,
  page = 1,
  limit = 20
): Promise<ListFilesResponse> {
  const url = `${API_BASE}/api/workspaces/${WORKSPACE_ID}/files/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`

  debug('Searching workspace files:', url)

  const headers: Record<string, string> = {}
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    let errorMessage = `Failed to search files with status ${response.status}`
    try {
      const errorData = await response.json()
      if (errorData?.message) {
        errorMessage = errorData.message
      }
    } catch {
      // Response body is not JSON
    }
    debug('Search files failed:', response.status, errorMessage)
    throw new Error(errorMessage)
  }

  const result = await response.json()
  debug('Search files successful:', result)
  return result
}

/**
 * Delete a file from the workspace
 */
export async function deleteWorkspaceFile(jobId: string): Promise<void> {
  const url = `${API_BASE}/api/workspaces/${WORKSPACE_ID}/files/${jobId}`

  debug('Deleting file:', jobId)

  const headers: Record<string, string> = {}
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  })

  if (!response.ok) {
    let errorMessage = `Failed to delete file with status ${response.status}`
    try {
      const errorData = await response.json()
      if (errorData?.message) {
        errorMessage = errorData.message
      }
    } catch {
      // Response body is not JSON
    }
    debug('Delete file failed:', response.status, errorMessage)
    throw new Error(errorMessage)
  }

  debug('Delete file successful')
}

// ============================================
// Job Status Tracking
// ============================================

const PENDING_JOBS_KEY = 'leapcount_pending_jobs'

export interface JobStatus {
  jobId: string
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress: number
  result?: {
    chunksCreated?: number
    suggestions?: string[]
  }
}

export interface PendingJob {
  jobId: string
  fileName: string
  fileSize: number
  createdAt: number // timestamp
}

/**
 * Get processing status for a job
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const url = `${API_BASE}/api/jobs/${jobId}`

  debug('Fetching job status:', jobId)

  const headers: Record<string, string> = {}
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    let errorMessage = `Failed to get job status with status ${response.status}`
    try {
      const errorData = await response.json()
      if (errorData?.message) {
        errorMessage = errorData.message
      }
    } catch {
      // Response body is not JSON
    }
    debug('Get job status failed:', response.status, errorMessage)
    throw new Error(errorMessage)
  }

  const result = await response.json()
  debug('Job status:', result)
  return result
}

/**
 * Get all pending jobs from localStorage
 */
export function getPendingJobs(): PendingJob[] {
  try {
    const stored = localStorage.getItem(PENDING_JOBS_KEY)
    if (!stored) return []
    return JSON.parse(stored) as PendingJob[]
  } catch {
    return []
  }
}

/**
 * Add a job to the pending jobs list
 */
export function addPendingJob(job: PendingJob): void {
  const jobs = getPendingJobs()
  // Avoid duplicates
  if (!jobs.some(j => j.jobId === job.jobId)) {
    jobs.push(job)
    localStorage.setItem(PENDING_JOBS_KEY, JSON.stringify(jobs))
    debug('Added pending job:', job.jobId)
  }
}

/**
 * Remove a job from the pending jobs list
 */
export function removePendingJob(jobId: string): void {
  const jobs = getPendingJobs()
  const filtered = jobs.filter(j => j.jobId !== jobId)
  localStorage.setItem(PENDING_JOBS_KEY, JSON.stringify(filtered))
  debug('Removed pending job:', jobId)
}

/**
 * Clear all pending jobs
 */
export function clearPendingJobs(): void {
  localStorage.removeItem(PENDING_JOBS_KEY)
  debug('Cleared all pending jobs')
}

// ============================================
// Knowledge Graph
// ============================================

/**
 * Get the URL for the interactive graph viewer
 * Opens a Cytoscape.js visualization centered on the given node
 */
export function getGraphViewerUrl(nodeId?: string): string {
  const token = getAuthToken()
  let url = `${API_BASE}/api/workspaces/${WORKSPACE_ID}/graph/view`

  const params = new URLSearchParams()
  if (nodeId) {
    params.append('nodeId', nodeId)
  }
  if (token) {
    params.append('token', token)
  }

  const queryString = params.toString()
  if (queryString) {
    url += `?${queryString}`
  }

  return url
}

/**
 * Get graph data for a workspace
 */
export async function getGraphData(options?: {
  limit?: number
  offset?: number
  nodeType?: string
}): Promise<{
  nodes: Array<{
    id: string
    label: string
    type: string
    mentionCount: number
    confidence: number
  }>
  edges: Array<{
    source: string
    target: string
    relationship: string
  }>
  totalNodes: number
  totalEdges: number
  nodeTypes: string[]
}> {
  const params = new URLSearchParams()
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())
  if (options?.nodeType) params.append('nodeType', options.nodeType)

  const url = `${API_BASE}/api/workspaces/${WORKSPACE_ID}/graph/data?${params.toString()}`

  debug('Fetching graph data:', url)

  const headers: Record<string, string> = {}
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    throw new Error(`Failed to get graph data: ${response.status}`)
  }

  return response.json()
}

/**
 * Get entities for a specific file
 */
export async function getFileEntities(jobId: string): Promise<{
  entities: Array<{
    id: string
    entityType: string
    fields: Record<string, unknown>
    sourceText: string
    confidence: number
    fileName: string
  }>
  pagination: {
    total: number
    page: number
    limit: number
  }
}> {
  const url = `${API_BASE}/api/workspaces/${WORKSPACE_ID}/files/${jobId}/entities`

  debug('Fetching file entities:', url)

  const headers: Record<string, string> = {}
  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    throw new Error(`Failed to get file entities: ${response.status}`)
  }

  return response.json()
}
