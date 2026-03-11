const API_BASE = import.meta.env.VITE_API_URL || '/api'
const API_KEY = import.meta.env.VITE_API_KEY || ''
const AUTH_TOKEN_KEY = 'leapcount_auth_token'
const DEBUG = import.meta.env.VITE_DEBUG === 'true'

function debug(...args: unknown[]) {
  if (DEBUG) {
    console.log('[api]', ...args)
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Login with API key to get a Bearer token
 */
export async function loginWithApiKey(): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: API_KEY }),
  })

  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to authenticate with API key')
  }

  const data = await response.json()
  const token = data.token
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  return token
}

/**
 * Get stored token or login to get a new one
 */
export async function ensureAuthenticated(): Promise<string> {
  let token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (!token && API_KEY) {
    token = await loginWithApiKey()
  }
  return token || ''
}

/**
 * Get auth headers with Bearer token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

interface RequestOptions extends RequestInit {
  _isRetry?: boolean
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  // Only include Content-Type for requests with a body
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(options.headers as Record<string, string>),
  }
  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    // Handle 401 - try to re-authenticate
    if (response.status === 401 && !options._isRetry && API_KEY) {
      localStorage.removeItem(AUTH_TOKEN_KEY)
      try {
        await loginWithApiKey()
        // Retry the original request with new token
        return request<T>(endpoint, { ...options, _isRetry: true })
      } catch {
        // Re-auth failed, throw original error
      }
    }

    let message = `Request failed with status ${response.status}`
    let data: unknown

    try {
      data = await response.json()
      debug('API error:', options.method || 'GET', url, response.status, data)
      if (typeof data === 'object' && data !== null && 'message' in data) {
        message = (data as { message: string }).message
      }
    } catch {
      // Response body is not JSON
    }

    throw new ApiError(response.status, message, data)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export async function streamRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const data = await response.json()
      if (typeof data === 'object' && data !== null && 'message' in data) {
        message = (data as { message: string }).message
      }
    } catch {
      // Response body is not JSON
    }

    throw new ApiError(response.status, message)
  }

  if (!response.body) {
    throw new ApiError(500, 'Response body is not readable')
  }

  return response.body.getReader()
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),

  stream: (endpoint: string, body?: unknown) =>
    streamRequest(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
}
