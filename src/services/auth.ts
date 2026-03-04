import { BASE_API_URL, OTCS_OAUTH_URL, BYPASS_AUTH } from '../config/env'
import { ACCESS_TOKEN_KEY, AUTH_TOKEN_KEY, AUTH_USER_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../config/key'
import { CommonAPIResponse } from '../types/api'
import type { User } from '../types/chat'
import backendApi from './backend_api'

// Mock API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Mock user database
const mockUsers: { email: string; password: string; user: User }[] = [
  {
    email: 'demo@example.com',
    password: 'demo123',
    user: {
      id: '1',
      name: 'Demo User',
      email: 'demo@example.com',
    },
  },
]

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupCredentials {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
}

export interface LoginWithOTCSTokenResponse extends UserInfo {
  accessToken: string
  refreshToken: string
}

export interface UserInfo {
  email: string
  name: string
  otcsUserId: number
  userId: number
}

export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function loginWithOTCSToken(jwt: string): Promise<CommonAPIResponse<LoginWithOTCSTokenResponse>> {
  const response = await backendApi<CommonAPIResponse<LoginWithOTCSTokenResponse>>(`${BASE_API_URL}/api/auth/login/token`, {method: 'POST', data: { otcsToken: jwt, isTesting: BYPASS_AUTH }});

  const data = response.data;
  if(data.data != null) {
    const token = data.data?.accessToken;
    const refreshToken = data.data?.refreshToken;
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify({
      email: data.data.email,
      name: data.data.name,
      otcsUserId: data.data.otcsUserId,
      userId: data.data.userId,
    }));
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  }

  return data;
}

export async function refreshAccessToken(): Promise<CommonAPIResponse<RefreshTokenResponse> | null> {
  const response = await backendApi<CommonAPIResponse<RefreshTokenResponse>>(`${BASE_API_URL}/api/auth/refresh/token`, {
    method: 'POST',
    data: { refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) },
  })

  const data = response.data
  if(data.data != null) {
    const token = data.data?.accessToken;
    const refreshToken = data.data?.refreshToken;
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    return data;
  } else {
    window.location.href = OTCS_OAUTH_URL;
    return null;
  }
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  await delay(800)

  const found = mockUsers.find(
    u => u.email === credentials.email && u.password === credentials.password
  )

  if (!found) {
    throw new AuthError('Invalid email or password')
  }

  const token = `mock_token_${Date.now()}`

  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(found.user))

  return { user: found.user, token }
}

export async function signup(credentials: SignupCredentials): Promise<AuthResponse> {
  await delay(800)

  const exists = mockUsers.find(u => u.email === credentials.email)
  if (exists) {
    throw new AuthError('An account with this email already exists')
  }

  const newUser: User = {
    id: String(mockUsers.length + 1),
    name: credentials.name,
    email: credentials.email,
  }

  mockUsers.push({
    email: credentials.email,
    password: credentials.password,
    user: newUser,
  })

  const token = `mock_token_${Date.now()}`

  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser))

  return { user: newUser, token }
}

export function logout(): void {
  localStorage.clear()
}

export function getStoredAuth(): { user: User; token: string } | null {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const userJson = localStorage.getItem(AUTH_USER_KEY)

  if (!token || !userJson) {
    return null
  }

  try {
    const user = JSON.parse(userJson) as User
    return { user, token }
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}
