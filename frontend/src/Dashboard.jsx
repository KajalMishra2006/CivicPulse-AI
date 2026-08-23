import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { subscribeUserIssues, calculateIssueStats } from './firebase/issues.js'
import ReportIssue from './reportissue.jsx'
import './App.css'

function Dashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()
  const [showReport, setShowReport] = useState(false)
  const [issues, setIssues] = useState([])
  const [showIssues, setShowIssues] = useState(false)
  const [loadingIssues, setLoadingIssues] = useState(true)

  useEffect(() => {
    if (!currentUser?.uid) return

    setLoadingIssues(true)
    const unsubscribe = subscribeUserIssues(
      currentUser.uid,
      (userIssues) => {
        setIssues(userIssues)
        setLoadingIssues(false)
      },
      (err) => {
        console.error('Error loading issues:', err)
        setLoadingIssues(false)
      }
    )

    return () => unsubscribe()
  }, [currentUser?.uid])

  const stats = calculateIssueStats(issues)

  async function handleLogoutClick() {
    if (onLogout) {
      onLogout()
    } else {
      await logout()
    }
  }

  if (showReport) {
    return (
      <ReportIssue
        onBack={() => setShowReport(false)}
        onIssueSubmitted={() => {
          setShowReport(false)
          setShowIssues(true)
        }}
      />
    )
  }

  if (showIssues) {
    return (
      <div className="report-page">
        <div className="report-card issue-list-card">
          <button
            type="button"
            className="back-button"
            onClick={() => setShowIssues(false)}
          >
            ← Back to Dashboard
          </button>

          <h1>My Issues</h1>

          {loadingIssues ? (
            <p>Loading your reported issues...</p>
          ) : issues.length === 0 ? (
            <p>You haven't reported any issues yet.</p>
          ) : (
            issues.map((issue) => (
              <div key={issue.id || issue.title} className="issue-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <h2 style={{ margin: 0 }}>{issue.title}</h2>
                  {issue.priority && (
                    <span className={`priority-badge priority-${(issue.priority || 'Medium').toLowerCase()}`}>
                      {issue.priority} Priority
                    </span>
                  )}
                </div>

                <p>
                  <strong>Category:</strong> {issue.category}
                </p>

                <p>
                  <strong>Description:</strong> {issue.description}
                </p>

                <p>
                  <strong>Location:</strong> {issue.location}
                </p>

                <p>
                  <strong>Status:</strong>{' '}
                  <span className={`status-badge status-${(issue.status || 'Pending').toLowerCase().replace(' ', '-')}`}>
                    {issue.status || 'Pending'}
                  </span>
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
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      <nav className="navbar">
        <h2>CivicPulse-AI</h2>

        <div className="nav-links">
          <button type="button" onClick={() => { setShowIssues(false); setShowReport(false); }}>
            Home
          </button>
          <button type="button" onClick={() => setShowReport(true)}>
            Report Issue
          </button>
          <button type="button" onClick={() => setShowIssues(true)}>
            My Issues
          </button>
          <button type="button" onClick={handleLogoutClick}>
            Logout
          </button>
        </div>
      </nav>

      <main className="dashboard-content">
        <section className="hero-section">
          <div>
            <p className="welcome-label">
              WELCOME TO CIVICPULSE-AI{userProfile?.name ? `, ${userProfile.name.toUpperCase()}` : ''}
            </p>

            <h1>Make Your Community Better.</h1>

            <p>
              Report civic problems, track their progress,
              and help create a better community.
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() => setShowReport(true)}
            >
              + Report an Issue
            </button>
          </div>
        </section>

        <section className="stats-container">
          <div className="stat-card">
            <span className="stat-icon">📢</span>
            <h2>{stats.total}</h2>
            <p>Issues Reported</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <h2>{stats.resolved}</h2>
            <p>Issues Resolved</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <h2>{stats.pending}</h2>
            <p>Pending Issues</p>
          </div>
        </section>

        <section className="dashboard-actions">
          <div className="action-card">
            <h2>Report a Civic Issue</h2>
            <p>
              Found a pothole, garbage problem, broken streetlight
              or another civic issue?
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() => setShowReport(true)}
            >
              Report Issue
            </button>
          </div>

          <div className="action-card">
            <h2>Track Your Issues</h2>
            <p>
              Check the status of the issues you have reported.
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowIssues(true)}
            >
              View My Issues
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Dashboard