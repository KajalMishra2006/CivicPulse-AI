import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import {
  subscribeScopedIssues,
  updateIssueStatus,
  calculateOfficialStats,
  getIssueGroupReports
} from './firebase/issues.js'
import {
  subscribeTalukaCitizens,
  getCitizenById,
  maskGovernmentId,
  maskPhoneNumber
} from './firebase/auth.js'
import {
  playTextToSpeech,
  stopTextToSpeech
} from './utils/speech.js'
import { translateComplaintDynamic } from './utils/complaintTranslator.js'
import ComplaintStatusChart from './ComplaintStatusChart.jsx'
import './App.css'

function GovernmentDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()

  const stateName = userProfile?.stateName || userProfile?.state || 'Maharashtra'
  const stateId = userProfile?.stateId || stateName.toLowerCase().replace(/\s+/g, '_')

  const districtName = userProfile?.districtName || userProfile?.district || 'Pune'
  const districtId = userProfile?.districtId || districtName.toLowerCase().replace(/\s+/g, '_')

  const talukaName = userProfile?.talukaName || userProfile?.taluka || 'Haveli'
  const talukaId = userProfile?.talukaId || talukaName.toLowerCase().replace(/\s+/g, '_')

  // Canonical normalized keys
  const cleanStateId = (stateId || '').toLowerCase().trim().replace(/\s+/g, '_')
  const cleanDistrictId = (districtId || '').toLowerCase().trim().replace(/\s+/g, '_')
  const cleanTalukaId = (talukaId || '').toLowerCase().trim().replace(/\s+/g, '_')

  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [filterCategory, setFilterCategory] = useState('All')
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'in_progress' | 'resolved'
  const [resolutionNotes, setResolutionNotes] = useState('')

  // Clustered details modal state
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [groupReports, setGroupReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(false)

  // Dynamic Translation & Voice in Details
  const [translationLang, setTranslationLang] = useState('English')
  const [translatedText, setTranslatedText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // 1 & 2. Citizens in Taluka state
  const [citizens, setCitizens] = useState([])
  const [loadingCitizens, setLoadingCitizens] = useState(true)
  const [citizensError, setCitizensError] = useState('')
  const [citizenSearchTerm, setCitizenSearchTerm] = useState('')

  // 3 & 4. Citizen details modal state
  const [selectedCitizen, setSelectedCitizen] = useState(null)
  const [showCitizenModal, setShowCitizenModal] = useState(false)
  const [loadingCitizenDetail, setLoadingCitizenDetail] = useState(false)
  const [citizenModalError, setCitizenModalError] = useState('')

  // Primary view navigation tab ('complaints' | 'citizens')
  const [activeMainTab, setActiveMainTab] = useState('complaints')

  // Real-time subscription strictly scoped to Citizens in this Taluka
  useEffect(() => {
    setLoadingCitizens(true)
    setCitizensError('')
    const unsubCitizens = subscribeTalukaCitizens(
      { stateId: cleanStateId, districtId: cleanDistrictId, talukaId: cleanTalukaId },
      (talukaCitizens) => {
        setCitizens(talukaCitizens)
        setLoadingCitizens(false)
      },
      (err) => {
        console.error('[TALUKA OFFICER] Error loading citizens:', err)
        setCitizensError('Failed to load citizens for this taluka.')
        setLoadingCitizens(false)
      }
    )

    return () => unsubCitizens()
  }, [cleanStateId, cleanDistrictId, cleanTalukaId])

  useEffect(() => {
    // 1. Real-time subscription strictly scoped to this Taluka
    const unsubscribe = subscribeScopedIssues(
      { role: userProfile?.role || 'taluka_officer', stateId, districtId, talukaId },
      (scopedIssues) => {
        setIssues(scopedIssues)
        setLoading(false)
        setError('')
      },
      (err) => {
        console.error('Error fetching taluka issues:', err)
        setError('Failed to fetch taluka issues in real time.')
        setLoading(false)
      }
    )

    return () => {
      unsubscribe()
      stopTextToSpeech()
    }
  }, [stateId, districtId, talukaId])

  // Open modal and load grouped citizen reports
  async function handleOpenDetails(issue) {
    setSelectedIssue(issue)
    setTranslatedText('')
    setResolutionNotes(issue.resolutionNotes || '')
    setLoadingReports(true)

    try {
      const clusterId = issue.issueClusterId || issue.groupId || issue.id
      const reports = await getIssueGroupReports(clusterId)
      setGroupReports(reports.length > 0 ? reports : [issue])
    } catch (err) {
      console.error('Error loading cluster reports:', err)
      setGroupReports([issue])
    } finally {
      setLoadingReports(false)
    }
  }

  function handleCloseDetails() {
    setSelectedIssue(null)
    setGroupReports([])
    setTranslatedText('')
    stopTextToSpeech()
    setIsPlayingAudio(false)
  }

  // Handle dynamic translation
  async function handleTranslate(targetLang) {
    if (!selectedIssue) return
    setTranslationLang(targetLang)
    setIsTranslating(true)

    try {
      const result = await translateComplaintDynamic({
        text: selectedIssue.description,
        sourceLanguage: selectedIssue.preferredLanguage || selectedIssue.originalLanguage || 'Auto',
        targetLanguage: targetLang
      })
      setTranslatedText(result)
    } catch (err) {
      console.error('Translation error:', err)
    } finally {
      setIsTranslating(false)
    }
  }

  // Handle TTS audio reading
  function handleToggleAudio() {
    if (isPlayingAudio) {
      stopTextToSpeech()
      setIsPlayingAudio(false)
      return
    }

    if (!selectedIssue) return
    const textToSpeak = translatedText || selectedIssue.description
    const langToSpeak = translatedText ? translationLang : (selectedIssue.preferredLanguage || 'English')

    playTextToSpeech({
      text: textToSpeak,
      languageName: langToSpeak,
      onStart: () => setIsPlayingAudio(true),
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false)
    })
  }

  // Handle Status Update with Resolution Notes
  async function handleStatusChange(issueId, newStatus) {
    setUpdatingId(issueId)
    setError('')
    try {
      await updateIssueStatus(issueId, newStatus, currentUser?.uid, resolutionNotes)
      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue((prev) => ({ ...prev, status: newStatus, resolutionNotes }))
      }
    } catch (err) {
      console.error('Error updating status:', err)
      setError('Failed to update issue status. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  // 5. Verification helper to ensure citizen belongs strictly to officer's taluka
  function isCitizenInTalukaScope(citizen) {
    if (!citizen) return false
    const norm = (v) => (v || '').toLowerCase().trim().replace(/\s+/g, '_')
    const citState = norm(citizen.stateId || citizen.stateName || citizen.state)
    const citDist = norm(citizen.districtId || citizen.districtName || citizen.district)
    const citTal = norm(citizen.talukaId || citizen.talukaName || citizen.taluka)

    return citState === cleanStateId && citDist === cleanDistrictId && citTal === cleanTalukaId
  }

  // 3. Open Citizen Details directly
  function handleViewCitizenDetails(citizenData) {
    if (!citizenData) return

    // 5. Verify citizen belongs to officer's taluka before displaying
    if (!isCitizenInTalukaScope(citizenData)) {
      setCitizenModalError('Access Restricted: This citizen does not belong to your assigned taluka.')
      setSelectedCitizen(null)
      setShowCitizenModal(true)
      return
    }

    setCitizenModalError('')
    setSelectedCitizen(citizenData)
    setShowCitizenModal(true)
  }

  // 4. Open Citizen Details directly from complaint userId
  async function handleOpenCitizenFromComplaint(userId) {
    if (!userId) {
      setCitizenModalError('No citizen account identifier linked to this complaint.')
      setSelectedCitizen(null)
      setShowCitizenModal(true)
      return
    }

    // Check if citizen is already present in loaded citizens array
    const existing = citizens.find((c) => c.uid === userId || c.id === userId)
    if (existing) {
      handleViewCitizenDetails(existing)
      return
    }

    // Fetch from users/{userId}
    setLoadingCitizenDetail(true)
    setShowCitizenModal(true)
    setCitizenModalError('')
    setSelectedCitizen(null)

    try {
      const fetched = await getCitizenById(userId)
      if (!fetched) {
        setCitizenModalError('Citizen record not found in system.')
        return
      }
      handleViewCitizenDetails(fetched)
    } catch (err) {
      console.error('Error fetching citizen details:', err)
      if (err?.code === 'permission-denied') {
        setCitizenModalError('Access Denied: Security rules prevent viewing citizens outside your taluka.')
      } else {
        setCitizenModalError('Failed to load citizen details.')
      }
    } finally {
      setLoadingCitizenDetail(false)
    }
  }

  function handleCloseCitizenModal() {
    setSelectedCitizen(null)
    setShowCitizenModal(false)
    setCitizenModalError('')
  }

  // 7. Calculate complaints statistics for the selected citizen in this taluka
  const selectedCitizenComplaints = useMemo(() => {
    if (!selectedCitizen) return []
    const cid = selectedCitizen.uid || selectedCitizen.id
    return issues.filter((i) => i.userId === cid || (i.participantUserIds && i.participantUserIds.includes(cid)))
  }, [selectedCitizen, issues])

  const selectedCitizenStats = useMemo(() => {
    const total = selectedCitizenComplaints.length
    let pending = 0
    let inProgress = 0
    let resolved = 0

    selectedCitizenComplaints.forEach((i) => {
      const st = (i.status || 'Pending').toLowerCase().trim()
      if (st === 'resolved') {
        resolved++
      } else if (st === 'in progress' || st === 'in_progress') {
        inProgress++
      } else {
        pending++
      }
    })

    return { total, pending, inProgress, resolved }
  }, [selectedCitizenComplaints])

  // Filtered citizens in my taluka list based on search term
  const filteredCitizens = useMemo(() => {
    if (!citizenSearchTerm.trim()) return citizens
    const q = citizenSearchTerm.toLowerCase().trim()
    return citizens.filter((c) => {
      const name = (c.name || '').toLowerCase()
      const email = (c.email || '').toLowerCase()
      const phone = (c.mobileNumber || c.phone || '').toLowerCase()
      const area = (c.localArea || c.talukaName || c.taluka || '').toLowerCase()
      return name.includes(q) || email.includes(q) || phone.includes(q) || area.includes(q)
    })
  }, [citizens, citizenSearchTerm])

  // Filter issues based on active tab and category
  const filteredIssues = issues.filter((issue) => {
    const rawStatus = (issue.status || 'Pending').toLowerCase()
    if (activeTab === 'pending' && rawStatus !== 'pending') return false
    if (activeTab === 'in_progress' && rawStatus !== 'in progress') return false
    if (activeTab === 'resolved' && rawStatus !== 'resolved') return false

    if (filterCategory !== 'All' && issue.category !== filterCategory) return false
    return true
  })

  const stats = calculateOfficialStats(issues)

  return (
    <div className="dashboard-page">
      {/* 1. TOP NAVBAR */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div className="govbridge-nav-brand">
            <img src="/govbridge-logo.png" alt="GovBridge" className="govbridge-nav-logo" />
          </div>
          <span className="official-badge" style={{ background: '#059669' }}>
            Taluka Officer Operational Portal
          </span>
          <span style={{ fontSize: '13px', background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            📍 {talukaName} Taluka, {districtName}
          </span>
        </div>

        <div className="official-user-tag">
          <span>{userProfile?.name || currentUser?.email}</span>
          <button
            type="button"
            className="secondary-button"
            style={{ marginTop: 0 }}
            onClick={onLogout || logout}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* 2. MAIN VIEWPORT */}
      <main className="dashboard-content">
        <section className="hero-section" style={{ background: 'linear-gradient(135deg, #065f46 0%, #059669 100%)', color: 'white' }}>
          <div>
            <p className="welcome-label" style={{ color: '#a7f3d0' }}>TALUKA OFFICER OPERATIONAL COMMAND</p>
            <h1 style={{ color: 'white' }}>{talukaName} Taluka Civic Resolution</h1>
            <p style={{ color: '#d1fae5' }}>
              Real-time local complaint queue sorted by AI Priority Score. Manage field investigations, dynamic multilingual translations, voice reading, and mark status: Pending → In Progress → Resolved.
            </p>
          </div>
        </section>

        {error && <p className="error-message main-error">{error}</p>}

        {/* PROBLEM STATUS TALUKA CHART */}
        <ComplaintStatusChart
          title={`Problem Status — ${talukaName} Taluka`}
          pending={stats.pending}
          inProgress={stats.inProgress}
          resolved={stats.resolved}
        />

        {/* 3. KEY METRICS STATS CARDS */}
        <section className="stats-grid">
          <div
            className="stat-card"
            style={{
              cursor: 'pointer',
              border: activeMainTab === 'citizens' ? '2px solid #2563eb' : '1px solid #bfdbfe',
              background: '#eff6ff'
            }}
            onClick={() => setActiveMainTab('citizens')}
            title="Click to view Citizens in My Taluka"
          >
            <span className="stat-icon">👥</span>
            <h2 style={{ color: '#1d4ed8' }}>{loadingCitizens ? '...' : citizens.length}</h2>
            <p style={{ color: '#1e40af', fontWeight: '700' }}>Total Citizens</p>
          </div>

          <div
            className="stat-card"
            style={{
              cursor: 'pointer',
              border: activeMainTab === 'complaints' ? '2px solid #2563eb' : '1px solid #e2e8f0'
            }}
            onClick={() => setActiveMainTab('complaints')}
            title="Click to view Complaints Queue"
          >
            <span className="stat-icon">📋</span>
            <h2>{stats.total}</h2>
            <p>Total Complaints</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">🚨</span>
            <h2 style={{ color: '#dc2626' }}>{stats.highPriority}</h2>
            <p>High Priority</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <h2 style={{ color: '#eab308' }}>{stats.pending}</h2>
            <p>Pending</p>
          </div>

          <div className="stat-card">
            <span className="stat-icon">⚙️</span>
            <h2 style={{ color: '#0284c7' }}>{stats.inProgress}</h2>
            <p>In Progress</p>
          </div>

          <div className="stat-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span className="stat-icon">✅</span>
            <h2 style={{ color: '#166534' }}>{stats.resolved}</h2>
            <p style={{ color: '#15803d', fontWeight: '700' }}>Resolved</p>
          </div>
        </section>

        {/* PRIMARY VIEW NAVIGATION TABS */}
        <div style={{ display: 'flex', gap: '10px', margin: '24px 0 16px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`filter-btn ${activeMainTab === 'complaints' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('complaints')}
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>📋 Complaints Management ({issues.length})</span>
          </button>

          <button
            type="button"
            className={`filter-btn ${activeMainTab === 'citizens' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('citizens')}
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>👥 Citizens in My Taluka ({citizens.length})</span>
          </button>
        </div>

        {/* CITIZENS IN MY TALUKA SECTION */}
        {activeMainTab === 'citizens' && (
          <section className="stat-card" style={{ padding: '24px', background: 'white', marginTop: '10px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>👥</span> Citizens in My Taluka ({talukaName} Taluka)
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Showing verified citizens registered within {talukaName}, {districtName}. Contact information is provided for official complaint investigations.
                </p>
              </div>

              {/* Search bar */}
              <div style={{ minWidth: '240px' }}>
                <input
                  type="text"
                  placeholder="Search by name, email, phone, area..."
                  value={citizenSearchTerm}
                  onChange={(e) => setCitizenSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ padding: '8px 14px', fontSize: '13px', width: '100%' }}
                />
              </div>
            </div>

            {citizensError && (
              <p className="error-message main-error" style={{ marginBottom: '16px' }}>{citizensError}</p>
            )}

            {loadingCitizens ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <p>Loading citizens registered in {talukaName} Taluka...</p>
              </div>
            ) : filteredCitizens.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                <p style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 6px 0' }}>
                  {citizenSearchTerm ? 'No citizens found matching your search.' : `No citizens registered in ${talukaName} Taluka yet.`}
                </p>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                  {citizenSearchTerm ? 'Try adjusting your search keywords.' : 'Registrations from citizens in this taluka will automatically appear here in real time.'}
                </span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '12px 14px' }}>Name</th>
                      <th style={{ padding: '12px 14px' }}>Email</th>
                      <th style={{ padding: '12px 14px' }}>Phone</th>
                      <th style={{ padding: '12px 14px' }}>Area / Location</th>
                      <th style={{ padding: '12px 14px' }}>Complaints</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCitizens.map((cit) => {
                      const cid = cit.uid || cit.id
                      const citComplaintsCount = issues.filter(
                        (i) => i.userId === cid || (i.participantUserIds && i.participantUserIds.includes(cid))
                      ).length

                      return (
                        <tr key={cid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a' }}>
                            {cit.name || 'Citizen'}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#0369a1' }}>
                            <a href={`mailto:${cit.email}`} style={{ color: '#0284c7', textDecoration: 'none' }}>
                              {cit.email || 'N/A'}
                            </a>
                          </td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#0f766e', fontWeight: '600' }}>
                            {cit.mobileNumber || cit.phone || cit.maskedPhone || 'N/A'}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#334155' }}>
                            {cit.localArea || cit.talukaName || cit.taluka || talukaName}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontSize: '12px',
                              background: citComplaintsCount > 0 ? '#dbeafe' : '#f1f5f9',
                              color: citComplaintsCount > 0 ? '#1e40af' : '#64748b',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontWeight: '700'
                            }}>
                              {citComplaintsCount} complaint{citComplaintsCount === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '12px', fontWeight: '700' }}>
                              ✓ Active / Verified
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => handleViewCitizenDetails(cit)}
                              style={{ padding: '5px 12px', fontSize: '12px', marginTop: 0 }}
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* 4. QUEUE TABS & CATEGORY FILTER */}
        {activeMainTab === 'complaints' && (
          <>
            <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`filter-btn ${activeTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pending')}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
                >
                  ⏳ Active Pending Queue ({stats.pending})
                </button>

                <button
                  type="button"
                  className={`filter-btn ${activeTab === 'in_progress' ? 'active' : ''}`}
                  onClick={() => setActiveTab('in_progress')}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
                >
                  ⚙️ In Progress ({stats.inProgress})
                </button>

                <button
                  type="button"
                  className={`filter-btn ${activeTab === 'resolved' ? 'active' : ''}`}
                  onClick={() => setActiveTab('resolved')}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
                >
                  ✓ Resolved Archive ({stats.resolved})
                </button>
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="form-select"
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                <option value="All">All Categories</option>
                <option value="Roads">Roads & Potholes</option>
                <option value="Garbage">Garbage & Sanitation</option>
                <option value="Streetlight">Streetlights</option>
                <option value="Water">Water Supply</option>
                <option value="Drainage">Drainage & Flooding</option>
                <option value="Electricity">Electricity & Power</option>
                <option value="Other">Other Civic Issues</option>
              </select>
            </section>

        {/* 5. ISSUES QUEUE */}
        {loading ? (
          <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
            <p>Loading taluka complaint queue...</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="stat-card" style={{ padding: '30px', textAlign: 'center' }}>
            <p>No complaints in this queue for {talukaName} Taluka.</p>
          </div>
        ) : (
          <section className="issues-list-section">
            {filteredIssues.map((issue) => {
              const priorityClass = (issue.priority || 'MEDIUM').toLowerCase()
              const statusClass = (issue.status || 'Pending').toLowerCase().replace(' ', '-')
              const reportCount = issue.reportCount || 1

              return (
                <div
                  key={issue.id}
                  className={`issue-card priority-${priorityClass}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleOpenDetails(issue)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span className={`priority-badge priority-${priorityClass}`}>
                        {issue.priority || 'MEDIUM'} ({issue.priorityScore || 50}/100)
                      </span>

                      <h2 style={{ margin: 0, fontSize: '18px' }}>{issue.title}</h2>

                      {reportCount > 1 && (
                        <span style={{ fontSize: '12px', background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontWeight: '700' }}>
                          👥 {reportCount} Citizens Reported
                        </span>
                      )}
                    </div>

                    <span className={`status-badge status-${statusClass}`}>
                      {issue.status || 'Pending'}
                    </span>
                  </div>

                  <p style={{ margin: '8px 0', fontSize: '14px', color: '#334155' }}>
                    {issue.description}
                  </p>

                  <div className="issue-meta-row">
                    <div className="issue-meta-item">
                      <strong>Category:</strong> {issue.category}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Location:</strong> {issue.location || `${talukaName}, ${districtName}`}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Reported:</strong> {issue.createdAt?.seconds ? new Date(issue.createdAt.seconds * 1000).toLocaleString() : 'Recent'}
                    </div>
                    <div className="issue-meta-item">
                      <strong>Language:</strong> {issue.preferredLanguage || 'English'}
                    </div>
                  </div>

                  {/* CITIZEN DETAILS ROW */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      margin: '10px 0',
                      border: '1px solid #e2e8f0',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span style={{ fontSize: '13px', color: '#334155' }}>
                      👤 <strong>Citizen:</strong> {issue.userName || 'Citizen'}
                    </span>
                    {issue.userId && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleOpenCitizenFromComplaint(issue.userId)}
                        style={{ padding: '4px 12px', fontSize: '12px', marginTop: 0 }}
                      >
                        👁️ View Citizen Details
                      </button>
                    )}
                  </div>

                  {/* QUICK STATUS BUTTONS */}
                  <div
                    className="status-control-container"
                    style={{ marginTop: '12px', paddingTop: '10px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="status-control-label">Status Action:</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`status-btn-pill ${issue.status === 'Pending' ? 'active-pending' : ''}`}
                        disabled={updatingId === issue.id}
                        onClick={() => handleStatusChange(issue.id, 'Pending')}
                      >
                        Pending
                      </button>

                      <button
                        type="button"
                        className={`status-btn-pill ${issue.status === 'In Progress' ? 'active-progress' : ''}`}
                        disabled={updatingId === issue.id}
                        onClick={() => handleStatusChange(issue.id, 'In Progress')}
                      >
                        In Progress
                      </button>

                      <button
                        type="button"
                        className={`status-btn-pill ${issue.status === 'Resolved' ? 'active-resolved' : ''}`}
                        disabled={updatingId === issue.id}
                        onClick={() => handleStatusChange(issue.id, 'Resolved')}
                      >
                        ✓ Mark Resolved
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </section>
        )}
        </>
      )}
      </main>

      {/* 6. DETAILED CLUSTER MODAL WITH CITIZEN AUDIT LIST & AI TRANSLATION */}
      {selectedIssue && (
        <div className="gov-modal-backdrop" onClick={handleCloseDetails}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
            <button type="button" className="gov-modal-close" onClick={handleCloseDetails}>
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span className={`priority-badge priority-${(selectedIssue.priority || 'MEDIUM').toLowerCase()}`}>
                {selectedIssue.priority || 'MEDIUM'} ({selectedIssue.priorityScore || 50}/100)
              </span>
              <h2 style={{ margin: 0, fontSize: '22px' }}>{selectedIssue.title}</h2>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 14px 0' }}>
              📍 {selectedIssue.location || `${talukaName}, ${districtName}`} | Category: <strong>{selectedIssue.category}</strong>
            </p>

            {/* ORIGINAL COMPLAINT & AUDIO LISTENING */}
            <div style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                  Original Complaint Description ({selectedIssue.preferredLanguage || 'English'})
                </strong>

                <button
                  type="button"
                  className="btn-tts-listen"
                  onClick={handleToggleAudio}
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                >
                  {isPlayingAudio ? '⏹️ Stop Reading' : '🔊 Listen Aloud'}
                </button>
              </div>

              <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {translatedText || selectedIssue.description}
              </p>
            </div>

            {/* DYNAMIC GEMINI TRANSLATION TOOL */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                🌐 Translate Complaint:
              </span>
              {['English', 'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Bengali', 'Kannada'].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleTranslate(lang)}
                  disabled={isTranslating}
                  className={`filter-btn ${translationLang === lang ? 'active' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  {lang}
                </button>
              ))}
              {isTranslating && <span style={{ fontSize: '12px', color: '#0284c7' }}>Translating with Gemini AI...</span>}
            </div>

            {/* CITIZEN SUBMISSIONS IN THIS CLUSTER */}
            <div style={{ marginBottom: '18px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>👥</span> All Citizen Reports in This Cluster ({groupReports.length})
              </h3>

              {loadingReports ? (
                <p style={{ fontSize: '13px', color: '#64748b' }}>Loading reporting citizen details...</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px' }}>
                  {groupReports.map((rep, idx) => (
                    <div key={rep.id || idx} style={{ padding: '8px 10px', borderBottom: idx < groupReports.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#0f172a', fontWeight: '600', flexWrap: 'wrap', gap: '6px' }}>
                        <span>{idx + 1}. {rep.userName || rep.userEmail || 'Citizen'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontSize: '12px' }}>
                            {rep.createdAt?.seconds ? new Date(rep.createdAt.seconds * 1000).toLocaleString() : 'Recent'}
                          </span>
                          {rep.userId && (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => handleOpenCitizenFromComplaint(rep.userId)}
                              style={{ padding: '2px 8px', fontSize: '11px', marginTop: 0 }}
                            >
                              Citizen Details
                            </button>
                          )}
                        </div>
                      </div>
                      <p style={{ margin: '3px 0 0 0', color: '#475569', fontSize: '12px' }}>
                        "{rep.originalDescription || rep.description}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RESOLUTION NOTES & ACTIONS */}
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Resolution Notes / Action Taken:
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="e.g. Municipal road team dispatched; pothole filled with hot mix asphalt..."
                rows="2"
                className="form-textarea"
                style={{ width: '100%', marginBottom: '12px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ marginTop: 0 }}
                    onClick={() => handleStatusChange(selectedIssue.id, 'In Progress')}
                    disabled={updatingId === selectedIssue.id}
                  >
                    Mark In Progress
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ background: '#10b981', color: 'white', marginTop: 0 }}
                    onClick={() => handleStatusChange(selectedIssue.id, 'Resolved')}
                    disabled={updatingId === selectedIssue.id}
                  >
                    ✓ Save & Resolve Cluster
                  </button>
                </div>

                <button type="button" className="secondary-button" style={{ marginTop: 0 }} onClick={handleCloseDetails}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. CITIZEN DETAILS MODAL */}
      {showCitizenModal && (
        <div className="gov-modal-backdrop" onClick={handleCloseCitizenModal}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <button type="button" className="gov-modal-close" onClick={handleCloseCitizenModal}>
              ✕
            </button>

            {loadingCitizenDetail ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p>Loading citizen profile from Firestore...</p>
              </div>
            ) : citizenModalError ? (
              <div style={{ padding: '20px 0' }}>
                <div style={{ padding: '14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', marginBottom: '16px' }}>
                  <strong>⚠️ Access Restriction</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>{citizenModalError}</p>
                </div>
                <button type="button" className="secondary-button" onClick={handleCloseCitizenModal} style={{ marginTop: 0 }}>
                  Close
                </button>
              </div>
            ) : selectedCitizen ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <span style={{ fontSize: '28px' }}>👤</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>
                      Citizen Details
                    </h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Registered under {selectedCitizen.talukaName || selectedCitizen.taluka || talukaName} Taluka, {selectedCitizen.districtName || selectedCitizen.district || districtName} District
                    </p>
                  </div>
                </div>

                {/* BASIC CITIZEN INFORMATION */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px' }}>
                    <div>
                      <strong style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>Name</strong>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                        {selectedCitizen.name || 'Citizen'}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>Email Address</strong>
                      <a href={`mailto:${selectedCitizen.email}`} style={{ color: '#0284c7', fontWeight: '600', textDecoration: 'none' }}>
                        {selectedCitizen.email || 'N/A'}
                      </a>
                    </div>

                    <div>
                      <strong style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>Phone Number (Contact)</strong>
                      <a href={`tel:${selectedCitizen.mobileNumber || selectedCitizen.phone}`} style={{ color: '#0f766e', fontWeight: '700', fontFamily: 'monospace', textDecoration: 'none' }}>
                        📞 {selectedCitizen.mobileNumber || selectedCitizen.phone || selectedCitizen.maskedPhone || 'N/A'}
                      </a>
                    </div>

                    <div>
                      <strong style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>Local Area / Ward</strong>
                      <span style={{ color: '#334155' }}>
                        {selectedCitizen.localArea || 'Not specified'}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>Taluka</strong>
                      <span style={{ color: '#334155', fontWeight: '600' }}>
                        {selectedCitizen.talukaName || selectedCitizen.taluka || talukaName}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>District</strong>
                      <span style={{ color: '#334155', fontWeight: '600' }}>
                        {selectedCitizen.districtName || selectedCitizen.district || districtName}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>State</strong>
                      <span style={{ color: '#334155', fontWeight: '600' }}>
                        {selectedCitizen.stateName || selectedCitizen.state || stateName}
                      </span>
                    </div>

                    <div>
                      <strong style={{ color: '#475569', display: 'block', marginBottom: '2px' }}>Government ID (Masked)</strong>
                      <span style={{ fontFamily: 'monospace', color: '#64748b' }}>
                        {selectedCitizen.maskedIdNumber || maskGovernmentId(selectedCitizen.idNumber || selectedCitizen.normalizedGovernmentId) || 'Masked'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CITIZEN COMPLAINT STATISTICS */}
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0' }}>
                    Complaint Statistics in {talukaName} Taluka
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', display: 'block' }}>
                        {selectedCitizenStats.total}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Total Complaints</span>
                    </div>

                    <div style={{ background: '#fef9c3', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#ca8a04', display: 'block' }}>
                        {selectedCitizenStats.pending}
                      </span>
                      <span style={{ fontSize: '11px', color: '#854d0e', fontWeight: '600' }}>Pending</span>
                    </div>

                    <div style={{ background: '#e0f2fe', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#0284c7', display: 'block' }}>
                        {selectedCitizenStats.inProgress}
                      </span>
                      <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: '600' }}>In Progress</span>
                    </div>

                    <div style={{ background: '#dcfce7', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#15803d', display: 'block' }}>
                        {selectedCitizenStats.resolved}
                      </span>
                      <span style={{ fontSize: '11px', color: '#166534', fontWeight: '600' }}>Resolved</span>
                    </div>
                  </div>
                </div>

                {/* CITIZEN'S COMPLAINT LIST */}
                {selectedCitizenComplaints.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
                      Citizen's Complaints ({selectedCitizenComplaints.length})
                    </h3>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}>
                      {selectedCitizenComplaints.map((cIssue) => (
                        <div key={cIssue.id} style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                          <div>
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{cIssue.title}</span>
                            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>({cIssue.category})</span>
                          </div>
                          <span className={`status-badge status-${(cIssue.status || 'Pending').toLowerCase().replace(' ', '-')}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                            {cIssue.status || 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <button type="button" className="secondary-button" onClick={handleCloseCitizenModal} style={{ marginTop: 0 }}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default GovernmentDashboard
