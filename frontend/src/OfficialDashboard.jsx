import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import {
  subscribeAllIssues,
  updateIssueStatus,
  calculateOfficialStats
} from './firebase/issues.js'
import './App.css'

function OfficialDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('All')
  const [updatingId, setUpdatingId] = useState(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeAllIssues(
      (allIssues) => {
        setIssues(allIssues)
        setLoading(false)
      },
      (err) => {
        console.error('Error loading all issues for official dashboard:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const stats = calculateOfficialStats(issues)

  const filteredIssues = issues.filter((issue) => {
    if (filterStatus === 'All') return true
    return (issue.status || '').toLowerCase() === filterStatus.toLowerCase()
  })

  async function handleStatusChange(issueId, newStatus) {
    setActionError('')
    setUpdatingId(issueId)
    try {
      await updateIssueStatus(issueId, newStatus)
    } catch (err) {
      console.error('Failed to update issue status:', err)
      setActionError('Failed to update status. Please check permissions.')
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
    if (!timestamp) return 'Recently'
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
      return 'Recently'
    }
  }

  return (
    <div className="dashboard-page">
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2>CivicPulse-AI</h2>
          <span className="official-badge">Official Portal</span>
        </div>

        <div className="official-user-tag">
          <span>{userProfile?.name || currentUser?.email || 'Government Official'}</span>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 0 }}
            onClick={handleLogoutClick}
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="dashboard-content">
        <section className="hero-section">
          <div>
            <p className="welcome-label">GOVERNMENT & MUNICIPAL PORTAL</p>
            <h1>Civic Issues Overview</h1>
            <p>
              Review all citizen-reported infrastructure issues, track departmental progress,
              and update issue statuses in real time.
            </p>
          </div>
        </section>

        {actionError && <p className="error-message main-error">{actionError}</p>}

        {/* Statistics Summary */}
        <section className="stats-container-4">
          <div className="stat-card">
            <span className="stat-icon">📢</span>
            <h2>{stats.total}</h2>
            <p>Total Issues</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <h2>{stats.pending}</h2>
            <p>Pending</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⚙️</span>
            <h2>{stats.inProgress}</h2>
            <p>In Progress</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <h2>{stats.resolved}</h2>
            <p>Resolved</p>
          </div>
        </section>

        {/* Filters */}
        <div className="filter-bar">
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'All' ? 'active' : ''}`}
            onClick={() => setFilterStatus('All')}
          >
            All ({stats.total})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'Pending' ? 'active' : ''}`}
            onClick={() => setFilterStatus('Pending')}
          >
            Pending ({stats.pending})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'In Progress' ? 'active' : ''}`}
            onClick={() => setFilterStatus('In Progress')}
          >
            In Progress ({stats.inProgress})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'Resolved' ? 'active' : ''}`}
            onClick={() => setFilterStatus('Resolved')}
          >
            Resolved ({stats.resolved})
          </button>
        </div>

        {/* Issues List */}
        <section>
          {loading ? (
            <div className="stat-card">
              <p>Loading all citizen reported issues...</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="stat-card">
              <p>No issues found in this category.</p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div key={issue.id} className="issue-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <h2 style={{ margin: 0 }}>{issue.title}</h2>
                  <span className={`status-badge status-${(issue.status || 'Pending').toLowerCase().replace(' ', '-')}`}>
                    {issue.status || 'Pending'}
                  </span>
                </div>

                <div className="issue-meta-row">
                  <div className="issue-meta-item">
                    <strong>Category:</strong> {issue.category || 'General'}
                  </div>
                  <div className="issue-meta-item">
                    <strong>Location:</strong> {issue.location || 'Not specified'}
                  </div>
                  <div className="issue-meta-item">
                    <strong>Reported by:</strong> {issue.userName || 'Citizen'} ({issue.userEmail || 'No email'})
                  </div>
                  <div className="issue-meta-item">
                    <strong>Date:</strong> {formatDate(issue.createdAt)}
                  </div>
                </div>

                <p>
                  <strong>Description:</strong> {issue.description}
                </p>

                {issue.imageUrl && (
                  <div className="issue-image-preview">
                    <img
                      src={issue.imageUrl}
                      alt={issue.title}
                      className="issue-photo"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Status Control */}
                <div className="status-control-container">
                  <span className="status-control-label">Update Issue Status:</span>
                  <div className="status-actions">
                    <select
                      className="status-select"
                      value={issue.status || 'Pending'}
                      disabled={updatingId === issue.id}
                      onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                    {updatingId === issue.id && (
                      <span className="updating-indicator">Updating...</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  )
}

export default OfficialDashboard
