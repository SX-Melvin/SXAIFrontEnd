import { useState, useEffect, useCallback } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/ui/Toast'
import { WorkspacePage } from './components/Workspace/WorkspacePage'
import { LoadingScreen } from './components/ui/LoadingScreen'
import { AuthError } from './components/ui/AuthError'
import { ensureAuthenticated } from './services/api'
import './App.css'
import { AuthProvider } from './context/AuthContext'
import { Routes, Route, Navigate } from 'react-router-dom'
import { BYPASS_AUTH, OTCS_OAUTH_URL } from './config/env'
import { ExternalRedirect } from './components/common/ExternalRedirect'
import { OTCSOauthPage } from './components/Oauth/OTCSOauthPage'
import { ChatWithRAGLayout } from './components/ChatWithRAG/ChatWithRAGLayout'
import { LogoutPage } from './components/Oauth/LogoutPage'

type AuthState = 'loading' | 'authenticated' | 'error' | 'unauthenticated'

function App() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const authenticate = useCallback(async () => {
    setAuthState('loading')
    setErrorMessage('')
    try {
      if(localStorage.getItem('access_token') === null) {
        setAuthState('unauthenticated')
        return
      }
      await ensureAuthenticated()
      setAuthState('authenticated')
    } catch (error) {
      setAuthState('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to connect to server'
      )
    }
  }, [])

  useEffect(() => {
    authenticate()
  }, [authenticate])

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>

          {authState === 'loading' && (
            <LoadingScreen message="Connecting..." />
          )}

          {authState === 'error' && (
            <AuthError message={errorMessage} onRetry={authenticate} />
          )}

          {authState === 'authenticated' && (
            <Routes>
              <Route path="/otcs/redirect" element={<OTCSOauthPage />} />
              <Route path="/" element={<ChatWithRAGLayout />} />
              <Route path="/workspace" element={<WorkspacePage />} />
              <Route path="*" element={<Navigate to="/" />} />
              <Route path="/logout" element={<LogoutPage />} />
            </Routes>
          )}

          {authState === 'unauthenticated' && (
            <Routes>
              <Route path="/otcs/redirect" element={<OTCSOauthPage />} />
              <Route path="/logout" element={<LogoutPage />} />
              {
                BYPASS_AUTH  
                  ? <Route path="*" element={<Navigate to="/otcs/redirect" />} />
                  : <Route path="/" element={<ExternalRedirect url={OTCS_OAUTH_URL} />} />
              }
            </Routes>
          )}

        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
