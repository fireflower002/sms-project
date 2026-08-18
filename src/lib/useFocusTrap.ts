import { useEffect, useRef } from 'react'

interface FocusTrapOptions {
  /** Whether the modal/overlay is currently open */
  isOpen: boolean
  /** Callback fired when user presses Escape key */
  onClose?: () => void
  /** Optional specific element ref to focus upon opening */
  autoFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * useFocusTrap — Reusable custom hook to manage modal focus lifecycle:
 * 1. Focuses first interactive element or autoFocusRef on open.
 * 2. Traps Tab and Shift+Tab focus navigation within container.
 * 3. Handles Escape key to trigger onClose.
 * 4. Restores focus to previous active element upon modal unmount/closing.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  autoFocusRef,
}: FocusTrapOptions) {
  const containerRef = useRef<T>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Store active element prior to opening modal
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement
    }

    const container = containerRef.current
    if (!container) return

    const getFocusableElements = (): HTMLElement[] => {
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null)
    }

    // Auto-focus specified element or first focusable
    const focusables = getFocusableElements()
    if (autoFocusRef?.current) {
      autoFocusRef.current.focus()
    } else if (focusables.length > 0) {
      focusables[0].focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const currentFocusables = getFocusableElements()
        if (currentFocusables.length === 0) return

        const firstEl = currentFocusables[0]
        const lastEl = currentFocusables[currentFocusables.length - 1]

        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen, onClose, autoFocusRef])

  return containerRef
}
