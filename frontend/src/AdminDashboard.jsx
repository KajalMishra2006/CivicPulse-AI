import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import {
  subscribeVerificationRequests,
  approveVerificationRequest,
  rejectVerificationRequest
} from './firebase/verification.js'
import './App.css'

function AdminDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('pending')
  const [processingId, setProcessingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeVerificationRequests(
      (allRequests) => {
        setRequests(allRequests)
        setLoading(false)
      },
      (err) => {
        console.error('Error loading verification requests:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const total = requests.length
  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const approvedCount = requests.filter((r) => r.status === 'approved').length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length

  const filteredRequests = requests.filter((req) => {
    if (filterStatus === 'all') return true
    return (req.status || '').toLowerCase() === filterStatus.toLowerCase()
  })

  async function handleApprove(request) {
    setActionError('')
    setActionSuccess('')
    setProcessingId(request.id)

    try {
      await approveVerificationRequest(request.id, request.userId, currentUser?.uid)
      setActionSuccess(`Approved official request for ${request.name} (${request.email}).`)
    } catch (err) {
      console.error('Error approving request:', err)
      setActionError(err.message || 'Failed to approve request.')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(request) {
    setActionError('')
    setActionSuccess('')
    setProcessingId(request.id)

    try {
      await rejectVerificationRequest(request.id, currentUser?.uid)
      setActionSuccess(`Rejected official request for ${request.name} (${request.email}).`)
    } catch (err) {
      console.error('Error rejecting request:', err)
      setActionError(err.message || 'Failed to reject request.')
    } finally {
      setProcessingId(null)
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
    <div className="dashboard-page">
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2>CivicPulse-AI</h2>
          <span className="official-badge" style={{ background: '#7c3aed' }}>
            Admin Portal
          </span>
        </div>

        <div className="official-user-tag">
          <span>{userProfile?.name || currentUser?.email || 'Administrator'}</span>
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
            <p className="welcome-label" style={{ color: '#7c3aed' }}>ADMINISTRATOR CONTROL PANEL</p>
            <h1>Official Verification Approvals</h1>
            <p>
              Review government official access requests, verify employment credentials, and approve or reject administrative access.
            </p>
          </div>
        </section>

        {actionSuccess && (
          <div className="main-error" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#065f46' }}>
            {actionSuccess}
          </div>
        )}

        {actionError && <p className="error-message main-error">{actionError}</p>}

        {/* Summary Metrics */}
        <section className="stats-container-4">
          <div className="stat-card">
            <span className="stat-icon">📋</span>
            <h2>{total}</h2>
            <p>Total Requests</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <h2>{pendingCount}</h2>
            <p>Pending Review</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <h2>{approvedCount}</h2>
            <p>Approved Officials</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">❌</span>
            <h2>{rejectedCount}</h2>
            <p>Rejected</p>
          </div>
        </section>

        {/* Filter Tabs */}
        <div className="filter-bar">
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
            onClick={() => setFilterStatus('pending')}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'approved' ? 'active' : ''}`}
            onClick={() => setFilterStatus('approved')}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'rejected' ? 'active' : ''}`}
            onClick={() => setFilterStatus('rejected')}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All ({total})
          </button>
        </div>

        {/* Requests List */}
        <section>
          {loading ? (
            <div className="stat-card">
              <p>Loading verification requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="stat-card">
              <p>No verification requests found in this category.</p>
            </div>
          ) : (
            filteredRequests.map((req) => (
              <div key={req.id} className="issue-card" style={{ borderLeft: req.status === 'pending' ? '4px solid #f59e0b' : req.status === 'approved' ? '4px solid #10b981' : '4px solid #ef4444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>{req.name}</h2>
                    <span style={{ color: '#6b7280', fontSize: '13px' }}>{req.email}</span>
                  </div>

                  <span className={`status-badge status-${req.status === 'approved' ? 'resolved' : req.status === 'pending' ? 'pending' : 'rejected'}`} style={{ textTransform: 'capitalize' }}>
                    {req.status}
                  </span>
                </div>

                <div className="issue-meta-row">
                  <div className="issue-meta-item">
                    <strong>Organization:</strong> {req.organization}
                  </div>
                  <div className="issue-meta-item">
                    <strong>Department:</strong> {req.department}
                  </div>
                  <div className="issue-meta-item">
                    <strong>Employee ID:</strong> {req.employeeId}
                  </div>
                  <div className="issue-meta-item">
                    <strong>Requested:</strong> {formatDate(req.createdAt)}
                  </div>
                </div>

                <p style={{ margin: '12px 0 6px 0', color: '#374151', fontSize: '14px' }}>
                  <strong>Reason for Access:</strong> {req.reason}
                </p>

                {req.reviewedAt && (
                  <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '12px' }}>
                    Reviewed on {formatDate(req.reviewedAt)}
                  </p>
                )}

                {/* Review Action Controls for Pending Requests */}
                {req.status === 'pending' && (
                  <div className="status-control-container" style={{ marginTop: '16px', paddingTop: '14px' }}>
                    <span className="status-control-label">Administrator Action:</span>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="primary-button"
                        style={{
                          background: '#10b981',
                          color: 'white',
                          marginTop: 0,
                          padding: '8px 18px',
                          fontSize: '13px'
                        }}
                        disabled={processingId === req.id}
                        onClick={() => handleApprove(req)}
                      >
                        {processingId === req.id ? 'Processing...' : '✓ Approve Official'}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        style={{
                          background: '#fee2e2',
                          color: '#b91c1c',
                          marginTop: 0,
                          padding: '8px 18px',
                          fontSize: '13px'
                        }}
                        disabled={processingId === req.id}
                        onClick={() => handleReject(req)}
                      >
                        {processingId === req.id ? 'Processing...' : '✕ Reject'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  )
}

export default AdminDashboard
