import { useState } from 'react'
import './App.css'
import ReportIssue from './reportissue.jsx'

function Dashboard({ onLogout }) {

  const [showReport, setShowReport] = useState(false)
  const [issues, setIssues] = useState([])
  const [showIssues, setShowIssues] = useState(false)

  if (showReport) {
    return (
      <ReportIssue
        onBack={() => setShowReport(false)}
        onIssueSubmitted={(issue) => {
          setIssues([...issues, issue])
          setShowReport(false)
        }}
      />
    )
  }
  if (showIssues) {
  return (
    <div className="report-page">
      <div className="report-card">

        <button
          type="button"
          className="back-button"
          onClick={() => setShowIssues(false)}
        >
          ← Back to Dashboard
        </button>

        <h1>My Issues</h1>

        {issues.length === 0 ? (
          <p>You haven't reported any issues yet.</p>
        ) : (
          issues.map((issue, index) => (
            <div key={index} className="issue-card">

              <h2>{issue.title}</h2>

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
                <strong>Status:</strong> Pending
              </p>

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
          <button>Home</button>
          <button>Report Issue</button>
          <button onClick={() => setShowIssues(true)}>
            My Issues
          </button>
          <button onClick={onLogout}>Logout</button>
        </div>
      </nav>

      <main className="dashboard-content">

        <section className="hero-section">
          <div>
            <p className="welcome-label">WELCOME TO CIVICPULSE-AI</p>

            <h1>Make Your Community Better.</h1>

            <p>
              Report civic problems, track their progress,
              and help create a better community.
            </p>

            <button
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
            <h2>0</h2>
            <p>Issues Reported</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <h2>0</h2>
            <p>Issues Resolved</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <h2>0</h2>
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

            <button className="secondary-button">
              View My Issues
            </button>
          </div>

        </section>

      </main>

    </div>
  )
}

export default Dashboard