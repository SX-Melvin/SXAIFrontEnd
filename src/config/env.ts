export const API_BASE = import.meta.env.VITE_API_URL || ''
export const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID || 'test'
export const USER_ID = import.meta.env.VITE_USER_ID || ''
export const DEBUG = import.meta.env.VITE_DEBUG === 'true'
export const BASE_API_URL = import.meta.env.VITE_BASE_API_URL || ''
export const OTCS_OAUTH_REDIRECT_URL = import.meta.env.VITE_OTCS_OAUTH_REDIRECT_URL || ''
export const OTCS_OAUTH_LOGOUT_URL = import.meta.env.VITE_OTCS_OAUTH_LOGOUT_URL || ''
export const OTCS_OAUTH_CLIENT_ID = import.meta.env.VITE_OTCS_OAUTH_CLIENT_ID || ''
export const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH == "true" || false
export const OTCS_OAUTH_URL = import.meta.env.VITE_OTCS_OAUTH_URL.replace('{OAUTH_CLIENT_ID}', OTCS_OAUTH_CLIENT_ID).replace('{OAUTH_REDIRECT_URL}', OTCS_OAUTH_REDIRECT_URL);