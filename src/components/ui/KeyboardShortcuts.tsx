import { useEffect } from 'react'
import './KeyboardShortcuts.css'

interface KeyboardShortcutsProps {
  isOpen: boolean
  onClose: () => void
}

const shortcuts = [
  { keys: ['Ctrl', 'K'], description: 'New chat', mac: ['⌘', 'K'] },
  { keys: ['Ctrl', '/'], description: 'Focus input', mac: ['⌘', '/'] },
  { keys: ['Ctrl', '?'], description: 'Show shortcuts', mac: ['⌘', '?'] },
  { keys: ['Enter'], description: 'Send message', mac: ['Enter'] },
  { keys: ['Shift', 'Enter'], description: 'New line', mac: ['Shift', 'Enter'] },
  { keys: ['Escape'], description: 'Close modal / Cancel edit', mac: ['Escape'] },
]

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="shortcuts-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="shortcuts-list">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="shortcut-item">
              <span className="shortcut-description">{shortcut.description}</span>
              <span className="shortcut-keys">
                {(isMac ? shortcut.mac : shortcut.keys).map((key, keyIndex) => (
                  <span key={keyIndex}>
                    <kbd>{key}</kbd>
                    {keyIndex < (isMac ? shortcut.mac : shortcut.keys).length - 1 && (
                      <span className="shortcut-plus">+</span>
                    )}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="shortcuts-footer">
          <span className="shortcuts-hint">
            Press <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}
