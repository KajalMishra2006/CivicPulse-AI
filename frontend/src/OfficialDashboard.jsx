import { useState, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import {
  subscribeAllIssues,
  updateIssueStatus,
  calculateOfficialStats
} from './firebase/issues.js'
import {
  isSpeechSynthesisSupported,
  playTextToSpeech,
  stopTextToSpeech
} from './utils/speech.js'
import {
  getTranslation,
  translateCategory,
  translateStatus,
  translatePriority
} from './utils/translations.js'
import LanguageSelector from './LanguageSelector.jsx'
import './App.css'

function OfficialDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('All')
  const [updatingId, setUpdatingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [speakingIssueId, setSpeakingIssueId] = useState(null)

  // Language state for Official Dashboard
  const [governmentPreferredLanguage, setGovernmentPreferredLanguage] = useState(() => {
    return localStorage.getItem('civicpulse_gov_language') || 'English'
  })
  const t = getTranslation(governmentPreferredLanguage)

  useEffect(() => {
    const unsubscribe = subscribeAllIssues(
      (allIssues) => {
        setIssues(allIssues)
        setLoading(false)
      },
      (err) => {
        if (import.meta.env?.DEV) console.error('Error loading all issues for official dashboard:', err)
        setLoading(false)
      }
    )

    return () => {
      unsubscribe()
      stopTextToSpeech()
    }
  }, [])

  function handleGovLanguageChange(newLang) {
    if (!newLang) return
    setGovernmentPreferredLanguage(newLang)
    localStorage.setItem('civicpulse_gov_language', newLang)
    stopTextToSpeech()
    setSpeakingIssueId(null)
  }

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
      if (import.meta.env?.DEV) console.error('Failed to update issue status:', err)
      setActionError('Failed to update status. Please check permissions.')
    } finally {
      setUpdatingId(null)
    }
  }

  function handleToggleListen(issue) {
    if (speakingIssueId === issue.id) {
      stopTextToSpeech()
      setSpeakingIssueId(null)
      return
    }

    stopTextToSpeech()
    setSpeakingIssueId(issue.id)

    const priorityLabel = translatePriority(issue.priority, t)
    const statusLabel = translateStatus(issue.status, t)
    const categoryLabel = translateCategory(issue.category, t)

    const textToRead = `${issue.title}. ${categoryLabel}. ${t.status || 'Status'}: ${statusLabel}. ${t.priority || 'Priority'}: ${priorityLabel}. ${issue.description}`

    playTextToSpeech({
      text: textToRead,
      languageName: issue.preferredLanguage || governmentPreferredLanguage,
      onStart: () => setSpeakingIssueId(issue.id),
      onEnd: () => setSpeakingIssueId(null),
      onError: () => setSpeakingIssueId(null)
    })
  }

  async function handleLogoutClick() {
    stopTextToSpeech()
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
          <h2>CivicPulse<span className="brand-accent">-AI</span></h2>
          <span className="official-badge">{t.officialPortal || 'Official Portal'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Government Language Dropdown */}
          <LanguageSelector
            currentLanguage={governmentPreferredLanguage}
            onSelectLanguage={handleGovLanguageChange}
            variant="light"
            label={t.governmentLanguage || 'Govt Language'}
          />

          <div className="official-user-tag">
            <span>{userProfile?.name || currentUser?.email || 'Government Official'}</span>
            <button
              type="button"
              className="secondary-button"
              style={{ marginTop: 0 }}
              onClick={handleLogoutClick}
            >
              {t.logout || 'Logout'}
            </button>
          </div>
        </div>
      </nav>

      <main className="dashboard-content">
        <section className="hero-section">
          <div>
            <p className="welcome-label">GOVERNMENT & MUNICIPAL PORTAL</p>
            <h1>{t.civicIssuesOverview || 'Civic Issues Overview'}</h1>
            <p>
              {t.officialOverviewDesc || 'Review all citizen-reported infrastructure issues, track departmental progress, and update issue statuses in real time.'}
            </p>
          </div>
        </section>

        {actionError && <p className="error-message main-error">{actionError}</p>}

        {/* Statistics Summary */}
        <section className="stats-container-4">
          <div className="stat-card">
            <span className="stat-icon">📢</span>
            <h2>{stats.total}</h2>
            <p>{t.totalComplaints || 'Total Issues'}</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <h2>{stats.pending}</h2>
            <p>{t.pending || 'Pending'}</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⚙️</span>
            <h2>{stats.inProgress}</h2>
            <p>{t.inProgress || 'In Progress'}</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <h2>{stats.resolved}</h2>
            <p>{t.resolved || 'Resolved'}</p>
          </div>
        </section>

        {/* Filters */}
        <div className="filter-bar">
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'All' ? 'active' : ''}`}
            onClick={() => setFilterStatus('All')}
          >
            {t.all || 'All'} ({stats.total})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'Pending' ? 'active' : ''}`}
            onClick={() => setFilterStatus('Pending')}
          >
            {t.pending || 'Pending'} ({stats.pending})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'In Progress' ? 'active' : ''}`}
            onClick={() => setFilterStatus('In Progress')}
          >
            {t.inProgress || 'In Progress'} ({stats.inProgress})
          </button>
          <button
            type="button"
            className={`filter-btn ${filterStatus === 'Resolved' ? 'active' : ''}`}
            onClick={() => setFilterStatus('Resolved')}
          >
            {t.resolved || 'Resolved'} ({stats.resolved})
          </button>
        </div>

        {/* Issues List */}
        <section>
          {loading ? (
            <div className="stat-card">
              <p>{t.loadingIssues || 'Loading all citizen reported issues...'}</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="stat-card">
              <p>{t.noIssues || 'No issues found in this category.'}</p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <div key={issue.id} className="issue-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>{issue.title}</h2>
                    {issue.preferredLanguage && (
                      <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                        🌐 Citizen: {issue.preferredLanguage}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {isSpeechSynthesisSupported() && (
                      <button
                        type="button"
                        onClick={() => handleToggleListen(issue)}
                        className="btn-tts-listen"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        aria-label={speakingIssueId === issue.id ? 'Stop reading issue' : 'Listen to issue status aloud'}
                      >
                        {speakingIssueId === issue.id ? (t.stopReading || '⏹️ Stop') : (t.listenToStatus || '🔊 Listen')}
                      </button>
                    )}
                    <span className={`status-badge status-${(issue.status || 'Pending').toLowerCase().replace(' ', '-')}`}>
                      {translateStatus(issue.status, t)}
                    </span>
                  </div>
                </div>

                <div className="issue-meta-row">
                  <div className="issue-meta-item">
                    <strong>{t.category || 'Category'}:</strong> {translateCategory(issue.category, t)}
                  </div>
                  <div className="issue-meta-item">
                    <strong>{t.location || 'Location'}:</strong> {issue.location || 'Not specified'}
                  </div>
                  <div className="issue-meta-item">
                    <strong>{t.reportedBy || 'Reported by'}:</strong> {issue.userName || 'Citizen'} ({issue.userEmail || 'No email'})
                  </div>
                  <div className="issue-meta-item">
                    <strong>{t.date || 'Date'}:</strong> {formatDate(issue.createdAt)}
                  </div>
                </div>

                <p style={{ margin: '8px 0', color: '#334155', fontSize: '14px', lineHeight: '1.5' }}>
                  <strong>{t.description || 'Description'}:</strong> {issue.description}
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
                  <span className="status-control-label">{t.updateStatus || 'Update Issue Status'}:</span>
                  <div className="status-actions">
                    <select
                      className="status-select"
                      value={issue.status || 'Pending'}
                      disabled={updatingId === issue.id}
                      onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                    >
                      <option value="Pending">{t.pending || 'Pending'}</option>
                      <option value="In Progress">{t.inProgress || 'In Progress'}</option>
                      <option value="Resolved">{t.resolved || 'Resolved'}</option>
                    </select>
                    {updatingId === issue.id && (
                      <span className="updating-indicator">{t.updating || 'Updating...'}</span>
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
