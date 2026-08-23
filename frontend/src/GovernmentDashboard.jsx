import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import {
  subscribeAllIssues,
  updateIssueStatus,
  calculateOfficialStats
} from './firebase/issues.js'
import './App.css'

function GovernmentDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('queue') // 'overview' | 'queue' | 'high' | 'in_progress' | 'resolved'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeAllIssues(
      (allSortedIssues) => {
        setIssues(allSortedIssues)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching issues for Government Operations:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const stats = calculateOfficialStats(issues)

  // Filter issues based on activeTab and searchQuery
  const filteredIssues = issues.filter((issue) => {
    const priority = (issue.priority || 'Medium').toLowerCase()
    const status = (issue.status || 'Pending').toLowerCase()

    // Tab filter
    if (activeTab === 'high' && priority !== 'high') return false
    if (activeTab === 'in_progress' && status !== 'in progress') return false
    if (activeTab === 'resolved' && status !== 'resolved') return false
    if (activeTab === 'overview' && priority !== 'high' && status === 'resolved') return false

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchTitle = (issue.title || '').toLowerCase().includes(q)
      const matchCat = (issue.category || '').toLowerCase().includes(q)
      const matchLoc = (issue.location || '').toLowerCase().includes(q)
      const matchUser = (issue.userName || '').toLowerCase().includes(q)
      const matchDesc = (issue.description || '').toLowerCase().includes(q)
      return matchTitle || matchCat || matchLoc || matchUser || matchDesc
    }

    return true
  })

  async function handleStatusChange(issueId, newStatus) {
    setActionError('')
    setActionSuccess('')
    setUpdatingId(issueId)

    try {
      await updateIssueStatus(issueId, newStatus, currentUser?.uid)
      setActionSuccess(`Issue status updated to "${newStatus}".`)
      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
    } catch (err) {
      console.error('Error updating status:', err)
      setActionError(err.message || 'Failed to update issue status.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleLogoutClick() {
    if (onLogout) {
      onLogout()
    } else {
      await logout()
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'N/A'
    try {
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      }
      return new Date(timestamp).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    } catch {
      return 'N/A'
    }
  }

  return (
    <div className="gov-operations-layout">
      {/* 1. OPERATIONS SIDEBAR */}
      <aside className="gov-sidebar">
        <div className="gov-sidebar-brand">
          <h2>CivicPulse-AI</h2>
          <p>Government Operations</p>
        </div>

        <nav className="gov-sidebar-menu">
          <button
            type="button"
            className={`gov-menu-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span>📊 Operations Overview</span>
          </button>

          <button
            type="button"
            className={`gov-menu-item ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <span>📋 Complaint Queue</span>
            <span className="gov-badge-count">{stats.total}</span>
          </button>

          <button
            type="button"
            className={`gov-menu-item ${activeTab === 'high' ? 'active' : ''}`}
            onClick={() => setActiveTab('high')}
          >
            <span>🚨 High Priority</span>
            <span className="gov-badge-count" style={{ background: '#ef4444', color: 'white' }}>
              {stats.highPriority}
            </span>
          </button>

          <button
            type="button"
            className={`gov-menu-item ${activeTab === 'in_progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('in_progress')}
          >
            <span>⚙️ In Progress</span>
            <span className="gov-badge-count" style={{ background: '#0284c7', color: 'white' }}>
              {stats.inProgress}
            </span>
          </button>

          <button
            type="button"
            className={`gov-menu-item ${activeTab === 'resolved' ? 'active' : ''}`}
            onClick={() => setActiveTab('resolved')}
          >
            <span>✅ Resolved</span>
            <span className="gov-badge-count" style={{ background: '#10b981', color: 'white' }}>
              {stats.resolved}
            </span>
          </button>
        </nav>

        <div className="gov-sidebar-footer">
          <div className="gov-user-info">
            <p className="gov-user-name">{userProfile?.name || currentUser?.displayName || currentUser?.email || 'Official'}</p>
            <p className="gov-user-dept">{userProfile?.department || userProfile?.organization || 'Municipal Authority'}</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            style={{ width: '100%', marginTop: 0, padding: '8px 12px', fontSize: '13px' }}
            onClick={handleLogoutClick}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* 2. MAIN OPERATIONS VIEWPORT */}
      <div className="gov-main-viewport">
        <header className="gov-topbar">
          <div>
            <h1>
              {activeTab === 'overview' && 'Operations Center Overview'}
              {activeTab === 'queue' && 'Civic Complaints Priority Queue'}
              {activeTab === 'high' && '🚨 Critical & High Priority Queue'}
              {activeTab === 'in_progress' && '⚙️ In Progress Works'}
              {activeTab === 'resolved' && '✅ Resolved Complaints'}
            </h1>
            <p>Real-time civic operations triage and municipal task resolution</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="official-badge" style={{ margin: 0 }}>
              Official Portal
            </span>
          </div>
        </header>

        <main className="gov-content-area">
          {/* Operations 7-Metric Dashboard Bar */}
          <section className="gov-stats-7">
            <div className="gov-stat-card">
              <h3>{stats.total}</h3>
              <p>Total Complaints</p>
            </div>

            <div className="gov-stat-card stat-high">
              <h3 style={{ color: '#dc2626' }}>{stats.highPriority}</h3>
              <p>High Priority</p>
            </div>

            <div className="gov-stat-card stat-medium">
              <h3 style={{ color: '#d97706' }}>{stats.mediumPriority}</h3>
              <p>Medium Priority</p>
            </div>

            <div className="gov-stat-card stat-low">
              <h3 style={{ color: '#0369a1' }}>{stats.lowPriority}</h3>
              <p>Low Priority</p>
            </div>

            <div className="gov-stat-card stat-pending">
              <h3 style={{ color: '#eab308' }}>{stats.pending}</h3>
              <p>Pending</p>
            </div>

            <div className="gov-stat-card stat-inprogress">
              <h3 style={{ color: '#0284c7' }}>{stats.inProgress}</h3>
              <p>In Progress</p>
            </div>

            <div className="gov-stat-card stat-resolved">
              <h3 style={{ color: '#10b981' }}>{stats.resolved}</h3>
              <p>Resolved</p>
            </div>
          </section>

          {/* Feedback messages */}
          {actionSuccess && (
            <div className="main-error" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', marginBottom: '16px' }}>
              ✓ {actionSuccess}
            </div>
          )}
          {actionError && <p className="error-message main-error">{actionError}</p>}

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '240px', maxWidth: '450px' }}>
              <input
                type="text"
                placeholder="🔍 Search complaints by title, category, location, or citizen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>
              Showing <strong>{filteredIssues.length}</strong> complaints (Sorted: <strong>High → Medium → Low</strong>)
            </div>
          </div>

          {/* Complaints List */}
          <section>
            {loading ? (
              <div className="stat-card" style={{ padding: '32px', textAlign: 'center' }}>
                <p>Connecting to real-time operations feed...</p>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="stat-card" style={{ padding: '40px', textAlign: 'center' }}>
                <h3>No complaints found in this category</h3>
                <p style={{ color: '#64748b' }}>All tasks in this queue are currently cleared.</p>
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const priority = (issue.priority || 'Medium').toLowerCase()
                const status = (issue.status || 'Pending').toLowerCase()

                return (
                  <div
                    key={issue.id}
                    className={`gov-issue-card priority-border-${priority}`}
                  >
                    <div className="gov-card-header">
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span className={`priority-badge priority-${priority}`}>
                            {priority === 'high' && '🚨 '}
                            {issue.priority || 'Medium'}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                            Score: {issue.priorityScore || 50}/100
                          </span>
                        </div>

                        <h2 className="gov-card-title">{issue.title}</h2>
                      </div>

                      <div className="gov-badges-row">
                        <span className={`status-badge status-${status.replace(' ', '-')}`}>
                          {issue.status || 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="gov-meta-grid">
                      <div>
                        <strong>Category:</strong> {issue.category || 'General'}
                      </div>
                      <div>
                        <strong>Location:</strong> {issue.location || 'Not specified'}
                      </div>
                      <div>
                        <strong>Reported by:</strong> {issue.userName || 'Citizen'} ({issue.userEmail || 'N/A'})
                      </div>
                      <div>
                        <strong>Date:</strong> {formatDate(issue.createdAt)}
                      </div>
                    </div>

                    <p className="gov-card-description">
                      {issue.description}
                    </p>

                    {issue.imageUrl && (
                      <div style={{ marginBottom: '12px' }}>
                        <img
                          src={issue.imageUrl}
                          alt={issue.title}
                          className="issue-photo"
                          style={{ maxHeight: '160px', borderRadius: '8px' }}
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Operations Action Bar */}
                    <div className="gov-action-toolbar">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {status !== 'in progress' && status !== 'resolved' && (
                          <button
                            type="button"
                            className="btn-gov-work"
                            disabled={updatingId === issue.id}
                            onClick={() => handleStatusChange(issue.id, 'In Progress')}
                          >
                            {updatingId === issue.id ? 'Updating...' : '⚙️ Start Working'}
                          </button>
                        )}

                        {status !== 'resolved' && (
                          <button
                            type="button"
                            className="btn-gov-resolve"
                            disabled={updatingId === issue.id}
                            onClick={() => handleStatusChange(issue.id, 'Resolved')}
                          >
                            {updatingId === issue.id ? 'Updating...' : '✓ Mark as Resolved'}
                          </button>
                        )}

                        {status === 'resolved' && (
                          <span style={{ fontSize: '13px', color: '#059669', fontWeight: '600' }}>
                            ✓ Resolved on {formatDate(issue.resolvedAt || issue.updatedAt)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn-gov-details"
                        onClick={() => setSelectedIssue(issue)}
                      >
                        🔍 View Full Details
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </section>
        </main>
      </div>

      {/* 3. ISSUE DETAILS MODAL */}
      {selectedIssue && (
        <div className="gov-modal-backdrop" onClick={() => setSelectedIssue(null)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="gov-modal-close"
              onClick={() => setSelectedIssue(null)}
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span className={`priority-badge priority-${(selectedIssue.priority || 'Medium').toLowerCase()}`}>
                {selectedIssue.priority || 'Medium'} Priority
              </span>
              <span className={`status-badge status-${(selectedIssue.status || 'Pending').toLowerCase().replace(' ', '-')}`}>
                {selectedIssue.status || 'Pending'}
              </span>
            </div>

            <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#0f172a' }}>{selectedIssue.title}</h2>

            <div className="issue-meta-row" style={{ marginTop: 0 }}>
              <div className="issue-meta-item">
                <strong>Category:</strong> {selectedIssue.category || 'General'}
              </div>
              <div className="issue-meta-item">
                <strong>Location:</strong> {selectedIssue.location || 'Not specified'}
              </div>
              <div className="issue-meta-item">
                <strong>Priority Score:</strong> {selectedIssue.priorityScore || 50}/100
              </div>
            </div>

            {selectedIssue.latitude !== null && selectedIssue.latitude !== undefined && (
              <div style={{ padding: '8px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', margin: '10px 0', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ color: '#0369a1', fontWeight: '600' }}>
                  📍 GPS: {Number(selectedIssue.latitude).toFixed(5)}, {Number(selectedIssue.longitude).toFixed(5)}
                </span>
                <a
                  href={`https://maps.google.com/?q=${selectedIssue.latitude},${selectedIssue.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0284c7', fontWeight: '700', textDecoration: 'none', fontSize: '12px' }}
                >
                  🗺️ View on Google Maps ↗
                </a>
              </div>
            )}

            <div className="issue-meta-row">
              <div className="issue-meta-item">
                <strong>Reported by:</strong> {selectedIssue.userName || 'Citizen'}
              </div>
              <div className="issue-meta-item">
                <strong>Citizen Email:</strong> {selectedIssue.userEmail || 'N/A'}
              </div>
              <div className="issue-meta-item">
                <strong>Reported On:</strong> {formatDate(selectedIssue.createdAt)}
              </div>
            </div>

            <div style={{ margin: '16px 0' }}>
              <strong style={{ color: '#0f172a', fontSize: '14px' }}>Full Description:</strong>
              <p style={{ margin: '6px 0 0 0', color: '#334155', fontSize: '14px', lineHeight: '1.6' }}>
                {selectedIssue.description}
              </p>
            </div>

            {selectedIssue.imageUrl && (
              <div style={{ margin: '16px 0' }}>
                <strong style={{ color: '#0f172a', fontSize: '14px' }}>Attached Citizen Photo:</strong>
                <div style={{ marginTop: '8px' }}>
                  <img
                    src={selectedIssue.imageUrl}
                    alt={selectedIssue.title}
                    style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: '10px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}

            {selectedIssue.resolvedAt && (
              <div style={{ padding: '12px 16px', background: '#ecfdf5', borderRadius: '8px', margin: '16px 0', color: '#065f46', fontSize: '13px' }}>
                <strong>Resolved:</strong> {formatDate(selectedIssue.resolvedAt)} {selectedIssue.resolvedBy ? `by official (${selectedIssue.resolvedBy})` : ''}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              {(selectedIssue.status || '').toLowerCase() !== 'in progress' && (
                <button
                  type="button"
                  className="btn-gov-work"
                  disabled={updatingId === selectedIssue.id}
                  onClick={() => handleStatusChange(selectedIssue.id, 'In Progress')}
                >
                  ⚙️ Set In Progress
                </button>
              )}

              {(selectedIssue.status || '').toLowerCase() !== 'resolved' && (
                <button
                  type="button"
                  className="btn-gov-resolve"
                  disabled={updatingId === selectedIssue.id}
                  onClick={() => handleStatusChange(selectedIssue.id, 'Resolved')}
                >
                  ✓ Mark as Resolved
                </button>
              )}

              {(selectedIssue.status || '').toLowerCase() === 'resolved' && (
                <button
                  type="button"
                  className="btn-gov-work"
                  disabled={updatingId === selectedIssue.id}
                  onClick={() => handleStatusChange(selectedIssue.id, 'Pending')}
                >
                  ⏳ Re-open as Pending
                </button>
              )}

              <button
                type="button"
                className="secondary-button"
                style={{ marginLeft: 'auto', marginTop: 0 }}
                onClick={() => setSelectedIssue(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GovernmentDashboard
