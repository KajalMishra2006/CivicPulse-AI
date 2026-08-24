import { useState, useEffect, useRef } from 'react'

const THRESHOLD = 80 // px required to trigger refresh
const MAX_VISUAL = 120 // max visual distance for the indicator

function isInteractiveElement(target) {
  if (!target || !target.closest) return false
  return Boolean(
    target.closest(
      'input, textarea, select, button, a, label, option, [role="button"], [contenteditable="true"], .filter-btn, .primary-button, .secondary-button, .back-button, .back-button-styled, .submit-issue-btn, .gps-btn, .remove-image-btn, .nav-item, .google-button, .issue-photo, .image-preview, .form-file-input'
    )
  )
}

function PullToRefresh() {
  const [visualDistance, setVisualDistance] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState('idle') // 'idle' | 'pulling' | 'pulling-more' | 'ready' | 'refreshing'

  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    rawDistance: 0,
    isTouch: false
  })
  const isRefreshingRef = useRef(false)

  useEffect(() => {
    function handleStart(clientX, clientY, target, isTouch) {
      if (isRefreshingRef.current) return

      // Must be at the very top of the page
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0
      if (scrollY > 0) return

      // Ignore if interaction started on an interactive control
      if (isInteractiveElement(target)) return

      // On desktop mouse, only start if near the top portion of the screen (e.g. top 250px)
      if (!isTouch && clientY > 260) return

      dragRef.current = {
        active: true,
        startX: clientX,
        startY: clientY,
        rawDistance: 0,
        isTouch
      }
    }

    function handleMove(clientX, clientY) {
      if (isRefreshingRef.current || !dragRef.current.active) return

      const scrollY = window.scrollY || document.documentElement.scrollTop || 0
      if (scrollY > 0) {
        handleCancel()
        return
      }

      const deltaX = clientX - dragRef.current.startX
      const deltaY = clientY - dragRef.current.startY

      // Cancel if moving upwards or primarily horizontally (swipe/drag sideways)
      if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
        if (dragRef.current.rawDistance > 0) {
          dragRef.current.rawDistance = 0
          setIsDragging(false)
          setVisualDistance(0)
          setStatus('idle')
        }
        return
      }

      // User is dragging downward
      const rawDistance = deltaY
      dragRef.current.rawDistance = rawDistance

      // Calculate visual pull with smooth resistance
      const visual = Math.min(MAX_VISUAL, rawDistance * 0.5)

      if (rawDistance > 8) {
        setIsDragging(true)
        setVisualDistance(visual)

        if (rawDistance >= THRESHOLD) {
          setStatus('ready')
        } else if (rawDistance >= 50) {
          setStatus('pulling-more')
        } else {
          setStatus('pulling')
        }
      }
    }

    function handleEnd() {
      if (isRefreshingRef.current || !dragRef.current.active) return

      const { rawDistance } = dragRef.current
      dragRef.current.active = false

      if (rawDistance >= THRESHOLD) {
        isRefreshingRef.current = true
        setIsDragging(false)
        setStatus('refreshing')
        setVisualDistance(45)

        // Wait 250ms for user feedback then reload
        setTimeout(() => {
          window.location.reload()
        }, 250)
      } else {
        setIsDragging(false)
        setVisualDistance(0)
        setStatus('idle')
      }
    }

    function handleCancel() {
      if (isRefreshingRef.current) return
      dragRef.current.active = false
      dragRef.current.rawDistance = 0
      setIsDragging(false)
      setVisualDistance(0)
      setStatus('idle')
    }

    // Touch event listeners
    function onTouchStart(e) {
      if (!e.touches || e.touches.length !== 1) return
      handleStart(e.touches[0].clientX, e.touches[0].clientY, e.target, true)
    }

    function onTouchMove(e) {
      if (!e.touches || e.touches.length !== 1) return
      handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }

    function onTouchEnd() {
      handleEnd()
    }

    function onTouchCancel() {
      handleCancel()
    }

    // Mouse event listeners (Desktop)
    function onMouseDown(e) {
      // Only respond to primary left mouse button
      if (e.button !== 0) return
      handleStart(e.clientX, e.clientY, e.target, false)
    }

    function onMouseMove(e) {
      handleMove(e.clientX, e.clientY)
    }

    function onMouseUp(e) {
      if (e.button !== 0 && dragRef.current.active) return
      handleEnd()
    }

    function onMouseLeave(e) {
      // If mouse leaves the browser window during drag, cancel safely
      if (e.target === document || e.target === document.documentElement) {
        handleCancel()
      }
    }

    // Attach passive listeners
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchCancel, { passive: true })

    window.addEventListener('mousedown', onMouseDown, { passive: true })
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseup', onMouseUp, { passive: true })
    document.addEventListener('mouseleave', onMouseLeave, { passive: true })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchCancel)

      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  if (status === 'idle' && visualDistance === 0) {
    return null
  }

  const opacity = status === 'refreshing' ? 1 : Math.min(1, visualDistance / 30)
  const translateY = status === 'refreshing' ? 16 : Math.max(-50, visualDistance - 48)

  return (
    <div
      className="pull-to-refresh-container"
      style={{
        transform: `translateY(${translateY}px)`,
        opacity: opacity,
        transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease'
      }}
      aria-hidden="true"
    >
      <div className={`pull-to-refresh-pill ${status}`}>
        {status === 'pulling' && (
          <>
            <svg
              className="ptr-icon ptr-icon-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0F9D8A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
            <span className="ptr-text">↓ Pull to refresh</span>
          </>
        )}

        {status === 'pulling-more' && (
          <>
            <svg
              className="ptr-icon ptr-icon-arrow"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0F9D8A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
            <span className="ptr-text">↓ Keep pulling...</span>
          </>
        )}

        {status === 'ready' && (
          <>
            <svg
              className="ptr-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0F9D8A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span className="ptr-text">↻ Release to refresh</span>
          </>
        )}

        {status === 'refreshing' && (
          <>
            <svg
              className="ptr-icon ptr-spinning"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0F9D8A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span className="ptr-text">↻ Refreshing...</span>
          </>
        )}
      </div>
    </div>
  )
}

export default PullToRefresh
