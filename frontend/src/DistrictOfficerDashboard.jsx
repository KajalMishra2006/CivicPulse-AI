import { useState, useEffect, useMemo } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import {
  subscribeScopedIssues,
  updateIssueStatus,
  calculateOfficialStats,
  getIssueGroupReports
} from './firebase/issues.js'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase/config.js'
import { maskPhoneNumber, maskGovernmentId } from './firebase/auth.js'
import { playTextToSpeech, stopTextToSpeech } from './utils/speech.js'
import { translateComplaintDynamic } from './utils/complaintTranslator.js'
import { getTalukasForDistrict } from './utils/locations.js'
import ComplaintStatusChart from './ComplaintStatusChart.jsx'
import {
  subscribeScopedVerificationRequests,
  approveEmployeeHierarchy,
  rejectVerificationRequest,
  createOfficerHierarchyDirectly
} from './firebase/verification.js'
import {
  IconBuilding,
  IconUsers,
  IconClipboard,
  IconClock,
  IconActivity,
  IconCheckCircle,
  IconBarChart,
  IconLogOut,
  IconMapPin,
  IconShield
} from './Icons.jsx'
import './App.css'

export default function DistrictOfficerDashboard({ onLogout }) {
  const { currentUser, userProfile, logout } = useAuth()

  const stateName = userProfile?.stateName || userProfile?.state || 'Maharashtra'
  const stateId = userProfile?.stateId || stateName.toLowerCase().replace(/\s+/g, '_')

  const districtName = userProfile?.districtName || userProfile?.district || 'Pune'
  const districtId = userProfile?.districtId || districtName.toLowerCase().replace(/\s+/g, '_')

  // Top tabs: 'citizens' | 'complaints'
  const [activeMainTab, setActiveMainTab] = useState('citizens')

  // Citizen data & stats
  const [citizens, setCitizens] = useState([])
  const [loadingCitizens, setLoadingCitizens] = useState(true)
  const [chartRange, setChartRange] = useState('7d') // '7d' | '30d'

  // Talukas in this district
  const talukaList = useMemo(() => getTalukasForDistrict(stateName, districtName), [stateName, districtName])

  // Taluka Officers & Verification Requests in District
  const [talukaOfficers, setTalukaOfficers] = useState([])
  const [talukaRequests, setTalukaRequests] = useState([])
  const [actionSuccess, setActionSuccess] = useState('')
  const [actionError, setActionError] = useState('')
  const [processingReqId, setProcessingReqId] = useState(null)

  // Direct Taluka Officer Appointment Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOfficerName, setNewOfficerName] = useState('')
  const [newOfficerEmail, setNewOfficerEmail] = useState('')
  const [newOfficerPassword, setNewOfficerPassword] = useState('')
  const [newOfficerTaluka, setNewOfficerTaluka] = useState(talukaList[0]?.name || 'Haveli')
  const [newOfficerDept, setNewOfficerDept] = useState('Municipal Services & Field Operations')
  const [newOfficerEmpId, setNewOfficerEmpId] = useState('')
  const [newOfficerPhone, setNewOfficerPhone] = useState('')
  const [isCreatingOfficer, setIsCreatingOfficer] = useState(false)

  // Complaints data & management
  const [issues, setIssues] = useState([])
  const [loadingIssues, setLoadingIssues] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [filterCategory, setFilterCategory] = useState('All')
  const [complaintTab, setComplaintTab] = useState('pending') // 'pending' | 'in_progress' | 'resolved'
  const [resolutionNotes, setResolutionNotes] = useState('')

  // Details Modal
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [groupReports, setGroupReports] = useState([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [translationLang, setTranslationLang] = useState('English')
  const [translatedText, setTranslatedText] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // 1. Subscribe to Citizens in District
  useEffect(() => {
    setLoadingCitizens(true)
    const usersCol = collection(db, 'users')

    // Query scoped to this district
    const unsub = onSnapshot(
      usersCol,
      (snapshot) => {
        const districtCitizens = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => {
            const role = (u.role || 'citizen').toLowerCase()
            if (role !== 'citizen') return false

            const uDist = (u.district || u.districtName || u.districtId || '').toLowerCase().trim()
            const myDistName = districtName.toLowerCase().trim()
            const myDistId = districtId.toLowerCase().trim()

            return uDist === myDistName || uDist === myDistId || (u.districtId && u.districtId.toLowerCase() === myDistId)
          })

        districtCitizens.sort((a, b) => {
          const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0)
          const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0)
          return tB - tA
        })

        setCitizens(districtCitizens)
        setLoadingCitizens(false)
      },
      (err) => {
        console.error('[DISTRICT OFFICER] Error subscribing to district citizens:', err)
        setLoadingCitizens(false)
      }
    )

    return () => unsub()
  }, [districtName, districtId])

  // 2. Subscribe to Complaints in District
  useEffect(() => {
    setLoadingIssues(true)
    const unsub = subscribeScopedIssues(
      { role: 'district_officer', stateId, districtId },
      (districtIssues) => {
        setIssues(districtIssues)
        setLoadingIssues(false)
      },
      (err) => {
        console.error('[DISTRICT OFFICER] Error subscribing to issues:', err)
        setError('Failed to load district complaints.')
        setLoadingIssues(false)
      }
    )

    return () => {
      unsub()
      stopTextToSpeech()
    }
  }, [stateId, districtId])

  // 3. Subscribe to Taluka Officers & Verification Requests in District
  useEffect(() => {
    // Taluka Officers from users collection
    const usersCol = collection(db, 'users')
    const unsubOfficers = onSnapshot(usersCol, (snapshot) => {
      const myDistOfficers = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => {
          const role = (u.role || '').toLowerCase()
          if (role !== 'taluka_officer' && role !== 'issue_resolution_employee' && role !== 'citizen_access_employee') return false
          const uDist = (u.district || u.districtName || u.districtId || '').toLowerCase().trim()
          return uDist === districtName.toLowerCase().trim() || uDist === districtId.toLowerCase().trim()
        })
      setTalukaOfficers(myDistOfficers)
    })

    // Verification requests for Taluka Officer in this district
    const unsubReqs = subscribeScopedVerificationRequests(
      { role: 'district_officer', stateId, districtId },
      (reqs) => {
        const filtered = reqs.filter((r) => {
          const rRole = (r.requestedRole || r.employeeType || '').toLowerCase()
          return rRole === 'taluka_officer' || rRole === 'issue_resolution_employee' || rRole === 'citizen_access_employee' || rRole === 'issue_resolution' || rRole === 'citizen_access'
        })
        setTalukaRequests(filtered)
      },
      (err) => console.error('Taluka reqs error:', err)
    )

    return () => {
      unsubOfficers()
      unsubReqs()
    }
  }, [stateId, districtName, districtId])

  async function handleCreateTalukaOfficer(e) {
    e.preventDefault()
    setActionError('')
    setActionSuccess('')
    if (!newOfficerName.trim() || !newOfficerEmail.trim() || !newOfficerPassword || !newOfficerTaluka) {
      setActionError('Full Name, Official Email, Password, and Taluka are required.')
      return
    }
    if (newOfficerPassword.length < 8) {
      setActionError('Password must be at least 8 characters.')
      return
    }

    setIsCreatingOfficer(true)
    try {
      await createOfficerHierarchyDirectly({
        callerUid: currentUser?.uid,
        email: newOfficerEmail.trim(),
        password: newOfficerPassword,
        name: newOfficerName.trim(),
        role: 'taluka_officer',
        state: stateName,
        district: districtName,
        taluka: newOfficerTaluka,
        department: newOfficerDept.trim(),
        employeeId: newOfficerEmpId.trim(),
        mobileNumber: newOfficerPhone.trim()
      })
      setActionSuccess(`✓ Successfully appointed ${newOfficerName.trim()} as Taluka Officer for ${newOfficerTaluka}.`)
      setShowCreateModal(false)
      setNewOfficerName('')
      setNewOfficerEmail('')
      setNewOfficerPassword('')
      setNewOfficerEmpId('')
      setNewOfficerPhone('')
    } catch (err) {
      console.error('Failed to appoint Taluka Officer:', err)
      setActionError(err.message || 'Failed to appoint Taluka Officer.')
    } finally {
      setIsCreatingOfficer(false)
    }
  }

  async function handleApproveTalukaRequest(req, assignedTaluka) {
    setActionError('')
    setActionSuccess('')
    setProcessingReqId(req.id)
    try {
      await approveEmployeeHierarchy({
        requestId: req.id,
        userId: req.userId || req.applicantUid,
        assignedRole: 'taluka_officer',
        state: stateName,
        district: districtName,
        taluka: assignedTaluka || req.taluka || talukaList[0]?.name || 'Haveli',
        adminUid: currentUser?.uid
      })
      setActionSuccess(`✓ Approved Taluka Officer: ${req.name} for ${assignedTaluka || req.taluka}.`)
    } catch (err) {
      console.error('Failed to approve Taluka Officer:', err)
      setActionError(err.message || 'Failed to approve Taluka Officer.')
    } finally {
      setProcessingReqId(null)
    }
  }

  async function handleRejectTalukaRequest(req) {
    setActionError('')
    setActionSuccess('')
    setProcessingReqId(req.id)
    try {
      await rejectVerificationRequest(req.id, currentUser?.uid, `Credentials could not be verified by ${districtName} District Officer.`)
      setActionSuccess(`Rejected application for ${req.name}.`)
    } catch (err) {
      console.error('Failed to reject Taluka request:', err)
      setActionError(err.message || 'Failed to reject Taluka request.')
    } finally {
      setProcessingReqId(null)
    }
  }

  async function handleReassignTaluka(issueId, newTaluka) {
    try {
      await updateDoc(doc(db, 'issues', issueId), {
        taluka: newTaluka,
        talukaName: newTaluka,
        talukaId: newTaluka.toLowerCase().replace(/[\s_-]/g, ''),
        updatedAt: serverTimestamp()
      })
      setActionSuccess(`✓ Reassigned complaint to ${newTaluka} Taluka.`)
      setTimeout(() => setActionSuccess(''), 4000)
    } catch (err) {
      console.error('Failed to reassign taluka:', err)
      setError('Failed to reassign taluka: ' + err.message)
    }
  }

  // Calculate Citizen Overview Statistics
  const citizenStats = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const sevenDaysAgo = startOfToday - (6 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = startOfToday - (29 * 24 * 60 * 60 * 1000)

    let total = citizens.length
    let newToday = 0
    let newThisWeek = 0
    let newThisMonth = 0

    citizens.forEach((c) => {
      let createdMs = 0
      if (c.createdAt?.seconds) {
        createdMs = c.createdAt.seconds * 1000
      } else if (c.createdAt) {
        createdMs = new Date(c.createdAt).getTime()
      }

      if (createdMs >= startOfToday) {
        newToday++
      }
      if (createdMs >= sevenDaysAgo) {
        newThisWeek++
      }
      if (createdMs >= thirtyDaysAgo) {
        newThisMonth++
      }
    })

    return { total, newToday, newThisWeek, newThisMonth }
  }, [citizens])

  // Calculate Citizen Registration Trend Data for Line Chart
  const chartData = useMemo(() => {
    const days = chartRange === '30d' ? 30 : 7
    const result = []
    const now = new Date()

    // Initialize daily slots
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const dateKey = d.toISOString().split('T')[0]
      const label = days === 7
        ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })
        : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      result.push({ dateKey, label, count: 0 })
    }

    const keyIndexMap = new Map(result.map((item, idx) => [item.dateKey, idx]))

    citizens.forEach((c) => {
      let createdDate = null
      if (c.createdAt?.seconds) {
        createdDate = new Date(c.createdAt.seconds * 1000)
      } else if (c.createdAt) {
        createdDate = new Date(c.createdAt)
      }

      if (createdDate && !isNaN(createdDate.getTime())) {
        const key = createdDate.toISOString().split('T')[0]
        if (keyIndexMap.has(key)) {
          result[keyIndexMap.get(key)].count++
        }
      }
    })

    const totalInRange = result.reduce((sum, item) => sum + item.count, 0)
    return { points: result, totalInRange }
  }, [citizens, chartRange])

  // Complaint Overview Stats
  const complaintStats = calculateOfficialStats(issues)

  // Complaint Filtering
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const rawStatus = (issue.status || 'Pending').toLowerCase()
      if (complaintTab === 'pending' && rawStatus !== 'pending') return false
      if (complaintTab === 'in_progress' && rawStatus !== 'in progress') return false
      if (complaintTab === 'resolved' && rawStatus !== 'resolved') return false

      if (filterCategory !== 'All' && issue.category !== filterCategory) return false
      return true
    })
  }, [issues, complaintTab, filterCategory])

  // Handle complaint status change
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
      setError('Failed to update issue status.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Handle Open Details modal
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
      console.error('Error loading reports:', err)
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

  async function handleTranslate(targetLang) {
    if (!selectedIssue) return
    setTranslationLang(targetLang)
    setIsTranslating(true)
    try {
      const res = await translateComplaintDynamic({
        text: selectedIssue.description,
        sourceLanguage: selectedIssue.preferredLanguage || selectedIssue.originalLanguage || 'Auto',
        targetLanguage: targetLang
      })
      setTranslatedText(res)
    } catch (err) {
      console.error('Translation error:', err)
    } finally {
      setIsTranslating(false)
    }
  }

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

  function formatTimestamp(timestamp) {
    if (!timestamp) return 'Recently'
    try {
      const d = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp)
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Recently'
    }
  }

  return (
    <div className="dashboard-page">
      {/* 1. TOP NAVBAR */}
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div className="govbridge-nav-brand">
            <img src="/govbridge-logo.png" alt="GovBridge" className="govbridge-nav-logo" />
          </div>
          <span className="official-badge" style={{ background: '#0284c7' }}>
            <IconBuilding size={14} />
            <span>District Officer Portal</span>
          </span>
          <span style={{ fontSize: '13px', background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '20px', fontWeight: '700' }}>
            📍 {districtName} District, {stateName}
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
            <IconLogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <main className="dashboard-content">
        {/* HERO BANNER */}
        <section className="hero-section" style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)', color: 'white' }}>
          <div>
            <p className="welcome-label" style={{ color: '#bae6fd' }}>DISTRICT OPERATIONAL COMMAND</p>
            <h1 style={{ color: 'white' }}>{districtName} District Officer Operations</h1>
            <p style={{ color: '#e0f2fe' }}>
              Unified administration for {districtName} District. Real-time citizen statistics, registration trends, and full civic complaint resolution.
            </p>
          </div>
        </section>

        {actionSuccess && (
          <div className="main-error" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#065f46', marginBottom: '14px' }}>
            {actionSuccess}
          </div>
        )}

        {actionError && <p className="error-message main-error" style={{ marginBottom: '14px' }}>{actionError}</p>}
        {error && <p className="error-message main-error">{error}</p>}

        {/* PRIMARY VIEW NAVIGATION TABS */}
        <div style={{ display: 'flex', gap: '10px', margin: '20px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`filter-btn ${activeMainTab === 'citizens' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('citizens')}
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconUsers size={16} />
            <span>Citizen Overview & Registrations ({citizens.length})</span>
          </button>

          <button
            type="button"
            className={`filter-btn ${activeMainTab === 'taluka_officers' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('taluka_officers')}
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconShield size={16} />
            <span>Taluka Officers & Verification ({talukaOfficers.length})</span>
          </button>

          <button
            type="button"
            className={`filter-btn ${activeMainTab === 'complaints' ? 'active' : ''}`}
            onClick={() => setActiveMainTab('complaints')}
            style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <IconClipboard size={16} />
            <span>Complaint Management ({issues.length})</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* VIEW A: CITIZEN MANAGEMENT & REGISTRATION STATISTICS */}
        {/* ======================================================== */}
        {activeMainTab === 'citizens' && (
          <section className="citizen-management-section">
            {/* 1. CITIZEN OVERVIEW CARDS */}
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', color: '#0f172a', fontWeight: '800', margin: '0 0 6px 0' }}>
                Citizen Overview ({districtName} District)
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                Live metrics calculated strictly for citizens residing within {districtName} District.
              </p>
            </div>

            <section className="stats-grid" style={{ marginBottom: '28px' }}>
              <div className="stat-card">
                <span className="stat-icon">👥</span>
                <h2>{citizenStats.total}</h2>
                <p>Total Citizens</p>
              </div>

              <div className="stat-card">
                <span className="stat-icon">🌅</span>
                <h2 style={{ color: '#0284c7' }}>{citizenStats.newToday}</h2>
                <p>New Today</p>
              </div>

              <div className="stat-card">
                <span className="stat-icon">📅</span>
                <h2 style={{ color: '#0d9488' }}>{citizenStats.newThisWeek}</h2>
                <p>New This Week</p>
              </div>

              <div className="stat-card">
                <span className="stat-icon">📈</span>
                <h2 style={{ color: '#7c3aed' }}>{citizenStats.newThisMonth}</h2>
                <p>New This Month</p>
              </div>
            </section>

            {/* 2. CITIZEN REGISTRATION TREND LINE CHART */}
            <div className="stat-card" style={{ padding: '24px', marginBottom: '28px', background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconBarChart size={18} color="#0284c7" />
                    <span>Citizen Registration Trend: New Citizens Over Time</span>
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    Daily new citizen registrations in {districtName} District.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className={`filter-btn ${chartRange === '7d' ? 'active' : ''}`}
                    onClick={() => setChartRange('7d')}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '700' }}
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    className={`filter-btn ${chartRange === '30d' ? 'active' : ''}`}
                    onClick={() => setChartRange('30d')}
                    style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '700' }}
                  >
                    Last 30 Days
                  </button>
                </div>
              </div>

              {chartData.totalInRange === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <p style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 6px 0' }}>No new citizens registered in this period.</p>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>Registrations will appear automatically once new citizens register in {districtName}.</span>
                </div>
              ) : (
                /* Interactive Responsive SVG Line Chart */
                <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
                  <svg
                    viewBox="0 0 760 240"
                    style={{ width: '100%', minWidth: '580px', height: 'auto', display: 'block' }}
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0, 1, 2, 3, 4].map((step) => {
                      const y = 30 + step * 40
                      return (
                        <g key={step}>
                          <line x1="40" y1={y} x2="740" y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                        </g>
                      )
                    })}

                    {(() => {
                      const pts = chartData.points
                      const maxVal = Math.max(...pts.map((p) => p.count), 4)
                      const chartLeft = 50
                      const chartRight = 730
                      const chartTop = 30
                      const chartBottom = 190
                      const widthSpan = chartRight - chartLeft
                      const heightSpan = chartBottom - chartTop

                      const coords = pts.map((p, i) => {
                        const x = chartLeft + (i / Math.max(pts.length - 1, 1)) * widthSpan
                        const y = chartBottom - (p.count / maxVal) * heightSpan
                        return { x, y, ...p }
                      })

                      const pathD = coords.reduce((acc, pt, i) => {
                        return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
                      }, '')

                      const areaD = `${pathD} L ${coords[coords.length - 1].x} ${chartBottom} L ${coords[0].x} ${chartBottom} Z`

                      return (
                        <>
                          {/* Shaded Area */}
                          <path d={areaD} fill="url(#chartGradient)" />

                          {/* Line */}
                          <path d={pathD} fill="none" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                          {/* Points and Values */}
                          {coords.map((pt, i) => (
                            <g key={i}>
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={pt.count > 0 ? 5 : 3}
                                fill={pt.count > 0 ? '#0284c7' : '#94a3b8'}
                                stroke="white"
                                strokeWidth="2"
                              >
                                <title>{`${pt.label}: ${pt.count} registered citizen${pt.count === 1 ? '' : 's'}`}</title>
                              </circle>

                              {/* Value label on top of point if count > 0 */}
                              {pt.count > 0 && (
                                <text
                                  x={pt.x}
                                  y={pt.y - 10}
                                  textAnchor="middle"
                                  fill="#0369a1"
                                  fontSize="11"
                                  fontWeight="700"
                                >
                                  {pt.count}
                                </text>
                              )}

                              {/* X Axis Date Label */}
                              {(chartRange === '7d' || i % 4 === 0 || i === coords.length - 1) && (
                                <text
                                  x={pt.x}
                                  y={chartBottom + 22}
                                  textAnchor="middle"
                                  fill="#64748b"
                                  fontSize="10"
                                  fontWeight="600"
                                >
                                  {pt.label}
                                </text>
                              )}
                            </g>
                          ))}
                        </>
                      )
                    })()}
                  </svg>
                </div>
              )}
            </div>

            {/* 3. RECENTLY REGISTERED CITIZENS TABLE */}
            <div className="stat-card" style={{ padding: '24px', background: 'white' }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
                  Recently Registered Citizens ({districtName})
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Showing latest active citizen registrations. Personal contact and government ID information are masked for privacy.
                </p>
              </div>

              {loadingCitizens ? (
                <p style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading district citizens...</p>
              ) : citizens.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                  <p>No citizens registered in {districtName} District yet.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '12px 14px' }}>Citizen Name</th>
                        <th style={{ padding: '12px 14px' }}>Local Area / Ward</th>
                        <th style={{ padding: '12px 14px' }}>Registration Date</th>
                        <th style={{ padding: '12px 14px' }}>Masked Phone</th>
                        <th style={{ padding: '12px 14px' }}>Masked ID Number</th>
                        <th style={{ padding: '12px 14px' }}>Eligibility Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {citizens.slice(0, 15).map((citizen) => {
                        const maskedPhoneVal = citizen.maskedPhone || maskPhoneNumber(citizen.mobileNumber || citizen.phone)
                        const maskedIdVal = citizen.maskedIdNumber || maskGovernmentId(citizen.idNumber || citizen.normalizedGovernmentId || citizen.governmentId)

                        return (
                          <tr key={citizen.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a' }}>
                              {citizen.name || 'Citizen'}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#334155' }}>
                              {citizen.localArea || citizen.taluka || 'Local Area'}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#64748b' }}>
                              {formatTimestamp(citizen.createdAt)}
                            </td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#0369a1' }}>
                              {maskedPhoneVal}
                            </td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#0f766e' }}>
                              {maskedIdVal}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                ✓ Eligible / Active
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* VIEW C: TALUKA OFFICERS & APPOINTMENTS */}
        {/* ======================================================== */}
        {activeMainTab === 'taluka_officers' && (
          <section className="taluka-management-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontSize: '18px', color: '#0f172a', fontWeight: '800', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconShield size={20} color="#0284c7" />
                  <span>Taluka Officers & Verification ({districtName} District)</span>
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Manage field officers across all {talukaList.length} talukas of {districtName} District.
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() => setShowCreateModal(true)}
                style={{ marginTop: 0, padding: '8px 16px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>+ Appoint Taluka Officer</span>
              </button>
            </div>

            {/* TALUKAS JURISDICTION OVERVIEW GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              {talukaList.map((t) => {
                const officersCount = talukaOfficers.filter((o) => (o.talukaName || o.taluka || '').toLowerCase() === t.name.toLowerCase()).length
                const issuesCount = issues.filter((i) => (i.talukaName || i.taluka || '').toLowerCase() === t.name.toLowerCase()).length

                return (
                  <div key={t.id} className="stat-card" style={{ padding: '14px', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{t.name}</strong>
                      <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                        {officersCount} Officers
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      Active Complaints: <strong style={{ color: '#0f172a' }}>{issuesCount}</strong>
                    </p>
                  </div>
                )
              })}
            </div>

            {/* PENDING TALUKA VERIFICATION REQUESTS */}
            <div className="stat-card" style={{ padding: '20px', marginBottom: '24px', background: 'white' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px 0' }}>
                ⏳ Pending Taluka Officer Applications ({talukaRequests.filter((r) => r.status === 'pending').length})
              </h3>

              {talukaRequests.filter((r) => r.status === 'pending').length === 0 ? (
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
                  No pending Taluka Officer applications in {districtName} District.
                </p>
              ) : (
                talukaRequests.filter((r) => r.status === 'pending').map((req) => (
                  <div key={req.id} className="issue-card" style={{ borderLeft: '4px solid #f59e0b', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <strong style={{ fontSize: '15px', color: '#0f172a' }}>{req.name}</strong>
                        <p style={{ margin: '2px 0', fontSize: '12px', color: '#64748b' }}>{req.email} | Phone: {req.mobileNumber || 'N/A'}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#334155' }}>
                          Target Taluka: <strong>{req.taluka || 'Haveli'}</strong> | Department: {req.department} ({req.employeeId})
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="primary-button"
                          style={{ background: '#10b981', color: 'white', marginTop: 0, padding: '6px 14px', fontSize: '12px', fontWeight: '700' }}
                          disabled={processingReqId === req.id}
                          onClick={() => handleApproveTalukaRequest(req, req.taluka || talukaList[0]?.name)}
                        >
                          ✓ Approve
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ background: '#fee2e2', color: '#b91c1c', marginTop: 0, padding: '6px 14px', fontSize: '12px', fontWeight: '600' }}
                          disabled={processingReqId === req.id}
                          onClick={() => handleRejectTalukaRequest(req)}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ACTIVE TALUKA OFFICERS DIRECTORY */}
            <div className="stat-card" style={{ padding: '20px', background: 'white' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 12px 0' }}>
                👮 Active Taluka Officers ({talukaOfficers.length})
              </h3>

              {talukaOfficers.length === 0 ? (
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
                  No active Taluka Officers registered in {districtName} District yet. Use the button above to appoint officers.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                  {talukaOfficers.map((officer) => (
                    <div key={officer.id} style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{officer.name || officer.email}</strong>
                        <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                          Active
                        </span>
                      </div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#64748b' }}>{officer.email}</p>
                      <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#0369a1', fontWeight: '600' }}>
                        📍 Taluka: {officer.talukaName || officer.taluka || 'District Field'}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                        {officer.department || 'Field Department'} ({officer.employeeId || 'ID'})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* VIEW B: COMPLAINT MANAGEMENT (DISTRICT OVERVIEW) */}
        {/* ======================================================== */}
        {activeMainTab === 'complaints' && (
          <section className="complaint-management-section">
            {/* PROBLEM STATUS DISTRICT CHART */}
            <ComplaintStatusChart
              title={`Problem Status — ${districtName} District`}
              pending={complaintStats.pending}
              inProgress={complaintStats.inProgress}
              resolved={complaintStats.resolved}
            />

            {/* 1. COMPLAINT METRICS CARDS */}
            <section className="stats-grid" style={{ marginBottom: '24px' }}>
              <div className="stat-card">
                <span className="stat-icon">📋</span>
                <h2>{complaintStats.total}</h2>
                <p>Total Complaints</p>
              </div>

              <div className="stat-card">
                <span className="stat-icon">🚨</span>
                <h2 style={{ color: '#dc2626' }}>{complaintStats.highPriority}</h2>
                <p>High Priority</p>
              </div>

              <div className="stat-card">
                <span className="stat-icon">⏳</span>
                <h2 style={{ color: '#eab308' }}>{complaintStats.pending}</h2>
                <p>Pending</p>
              </div>

              <div className="stat-card">
                <span className="stat-icon">⚙️</span>
                <h2 style={{ color: '#0284c7' }}>{complaintStats.inProgress}</h2>
                <p>In Progress</p>
              </div>

              <div className="stat-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <span className="stat-icon">✅</span>
                <h2 style={{ color: '#166534' }}>{complaintStats.resolved}</h2>
                <p style={{ color: '#15803d', fontWeight: '700' }}>Resolved</p>
              </div>
            </section>

            {/* 2. COMPLAINT QUEUE TABS & CATEGORY FILTER */}
            <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`filter-btn ${complaintTab === 'pending' ? 'active' : ''}`}
                  onClick={() => setComplaintTab('pending')}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
                >
                  ⏳ Pending ({complaintStats.pending})
                </button>

                <button
                  type="button"
                  className={`filter-btn ${complaintTab === 'in_progress' ? 'active' : ''}`}
                  onClick={() => setComplaintTab('in_progress')}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
                >
                  ⚙️ In Progress ({complaintStats.inProgress})
                </button>

                <button
                  type="button"
                  className={`filter-btn ${complaintTab === 'resolved' ? 'active' : ''}`}
                  onClick={() => setComplaintTab('resolved')}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700' }}
                >
                  ✅ Resolved ({complaintStats.resolved})
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Category:</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="form-select"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
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
              </div>
            </section>

            {/* 3. ISSUES LIST */}
            {loadingIssues ? (
              <div className="stat-card" style={{ padding: '40px', textAlign: 'center' }}>
                <p>Loading district complaints...</p>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="stat-card" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <p>No complaints found in this category / status.</p>
              </div>
            ) : (
              <section className="issues-list-section">
                {filteredIssues.map((issue) => {
                  const priority = (issue.priority || 'Medium').toLowerCase()
                  const status = (issue.status || 'Pending').toLowerCase()
                  const score = typeof issue.priorityScore === 'number' ? issue.priorityScore : (Number(issue.priorityScore) || 50)
                  const count = issue.reportCount || 1

                  return (
                    <div key={issue.id} className="issue-card" style={{ borderLeft: priority === 'high' ? '4px solid #dc2626' : undefined }}>
                      <div className="issue-header-row">
                        <div className="issue-title-group">
                          <span className={`priority-badge priority-${priority}`}>
                            {priority === 'high' && '🚨 '}
                            {issue.priority || 'MEDIUM'}
                          </span>
                          <span className="priority-score-badge">
                            Score: {score}
                          </span>
                          {count > 1 && (
                            <span className="cluster-badge">
                              👥 {count} Citizen Reports Grouped
                            </span>
                          )}
                          <h2 className="issue-title">{issue.title}</h2>
                        </div>

                        <span className={`status-badge status-${status.replace(' ', '-')}`}>
                          {issue.status || 'Pending'}
                        </span>
                      </div>

                      <div className="issue-meta-row">
                        <div className="issue-meta-item">
                          <strong>Category:</strong> {issue.category}
                        </div>
                        <div className="issue-meta-item">
                          <strong>Ward / Area:</strong> {issue.localArea || issue.taluka || 'District Area'}
                        </div>
                        <div className="issue-meta-item">
                          <strong>Date:</strong> {formatTimestamp(issue.createdAt)}
                        </div>
                        {issue.location && (
                          <div className="issue-meta-item">
                            <strong>Location:</strong> {issue.location}
                          </div>
                        )}
                      </div>

                      <p className="issue-description">{issue.description}</p>

                      {issue.aiTranslatedText && (
                        <div className="ai-translated-box">
                          <span className="ai-trans-label">✨ AI Translation (English):</span>
                          <p className="ai-trans-text">{issue.aiTranslatedText}</p>
                        </div>
                      )}

                      {issue.resolutionNotes && (
                        <div style={{ marginTop: '10px', padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '13px', color: '#166534' }}>
                          <strong>Resolution Notes:</strong> {issue.resolutionNotes}
                        </div>
                      )}

                      <div className="status-control-container">
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ marginTop: 0, padding: '6px 14px', fontSize: '12px' }}
                          onClick={() => handleOpenDetails(issue)}
                        >
                          👁️ View Details & Clustered Reports
                        </button>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className="status-control-label">Update Status:</span>
                          <button
                            type="button"
                            className="status-btn status-btn-in-progress"
                            disabled={updatingId === issue.id || status === 'in progress'}
                            onClick={() => handleStatusChange(issue.id, 'In Progress')}
                          >
                            Mark In Progress
                          </button>
                          <button
                            type="button"
                            className="status-btn status-btn-resolve"
                            disabled={updatingId === issue.id || status === 'resolved'}
                            onClick={() => handleStatusChange(issue.id, 'Resolved')}
                          >
                            Mark Resolved
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: 'auto' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Taluka:</span>
                          <select
                            value={issue.talukaName || issue.taluka || talukaList[0]?.name || ''}
                            onChange={(e) => handleReassignTaluka(issue.id, e.target.value)}
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px' }}
                          >
                            {talukaList.map((t) => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </section>
            )}
          </section>
        )}

        {/* DETAILS & CLUSTERED CITIZEN REPORTS MODAL */}
        {selectedIssue && (
          <div className="modal-backdrop" onClick={handleCloseDetails}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <span className={`priority-badge priority-${(selectedIssue.priority || 'Medium').toLowerCase()}`} style={{ marginRight: '8px' }}>
                    {selectedIssue.priority || 'MEDIUM'} (Score: {selectedIssue.priorityScore || 50})
                  </span>
                  <h2 style={{ margin: '8px 0 4px 0', fontSize: '20px' }}>{selectedIssue.title}</h2>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    {selectedIssue.category} • {selectedIssue.taluka || districtName}
                  </span>
                </div>
                <button type="button" className="close-btn" onClick={handleCloseDetails}>✕</button>
              </div>

              <div style={{ margin: '14px 0', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#334155' }}>Primary Description:</strong>
                <p style={{ margin: 0, color: '#475569' }}>{selectedIssue.description}</p>
              </div>

              {/* Dynamic Gemini Translation inside details */}
              <div style={{ margin: '14px 0', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>
                    ✨ Translate Description
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['English', 'Hindi', 'Marathi', 'Gujarati'].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleTranslate(lang)}
                        disabled={isTranslating}
                        style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #86efac', background: translationLang === lang ? '#16a34a' : 'white', color: translationLang === lang ? 'white' : '#166534', cursor: 'pointer', fontWeight: '600' }}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                {isTranslating ? (
                  <p style={{ fontSize: '12px', color: '#15803d', margin: 0 }}>Translating with Gemini AI...</p>
                ) : translatedText ? (
                  <p style={{ fontSize: '13px', color: '#166534', margin: 0, lineHeight: 1.5 }}>{translatedText}</p>
                ) : null}

                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleToggleAudio}
                    style={{ padding: '4px 10px', fontSize: '11px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    {isPlayingAudio ? '⏹️ Stop Audio' : '🔊 Listen Aloud (TTS)'}
                  </button>
                </div>
              </div>

              {/* Clustered citizen reports sub-list */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
                  👥 Citizen Reports in this Group ({groupReports.length})
                </h4>
                {loadingReports ? (
                  <p style={{ fontSize: '12px', color: '#64748b' }}>Loading grouped reports...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {groupReports.map((r, idx) => (
                      <div key={r.id || idx} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong style={{ color: '#1e293b' }}>{r.userName || 'Citizen'}</strong>
                          <span style={{ color: '#64748b' }}>{formatTimestamp(r.createdAt)}</span>
                        </div>
                        <p style={{ margin: '0 0 4px 0', color: '#475569' }}>{r.originalDescription || r.description}</p>
                        {r.location && <span style={{ color: '#0369a1' }}>📍 {r.location}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resolution Notes Input */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Official Resolution Notes:
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add notes explaining work done, field inspection status, or contractor assignment..."
                  rows="3"
                  className="form-textarea"
                  style={{ width: '100%', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="status-btn status-btn-in-progress"
                  disabled={updatingId === selectedIssue.id}
                  onClick={() => handleStatusChange(selectedIssue.id, 'In Progress')}
                >
                  Mark In Progress
                </button>
                <button
                  type="button"
                  className="status-btn status-btn-resolve"
                  disabled={updatingId === selectedIssue.id}
                  onClick={() => handleStatusChange(selectedIssue.id, 'Resolved')}
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIRECT TALUKA OFFICER APPOINTMENT MODAL */}
        {showCreateModal && (
        <div className="gov-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="gov-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <button type="button" className="gov-modal-close" onClick={() => setShowCreateModal(false)}>
              ✕
            </button>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
              🏛️ Appoint Taluka Officer ({districtName} District)
            </h3>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
              Directly provisions an active Taluka Officer credential in {districtName} district.
            </p>

            <form onSubmit={handleCreateTalukaOfficer}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Officer Anita Shinde"
                  value={newOfficerName}
                  onChange={(e) => setNewOfficerName(e.target.value)}
                  required
                  disabled={isCreatingOfficer}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Official Email *
                </label>
                <input
                  type="email"
                  placeholder="e.g. anita.shinde@taluka.gov.in"
                  value={newOfficerEmail}
                  onChange={(e) => setNewOfficerEmail(e.target.value)}
                  required
                  disabled={isCreatingOfficer}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Password * (min 8 chars)
                </label>
                <input
                  type="password"
                  placeholder="Enter secure initial password"
                  value={newOfficerPassword}
                  onChange={(e) => setNewOfficerPassword(e.target.value)}
                  required
                  disabled={isCreatingOfficer}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Assigned Taluka * ({districtName} District)
                </label>
                <select
                  value={newOfficerTaluka}
                  onChange={(e) => setNewOfficerTaluka(e.target.value)}
                  disabled={isCreatingOfficer}
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  {talukaList.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={newOfficerDept}
                    onChange={(e) => setNewOfficerDept(e.target.value)}
                    disabled={isCreatingOfficer}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Employee ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TO-HAV-01"
                    value={newOfficerEmpId}
                    onChange={(e) => setNewOfficerEmpId(e.target.value)}
                    disabled={isCreatingOfficer}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreatingOfficer}
                  style={{ marginTop: 0 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOfficer}
                  className="primary-button"
                  style={{ marginTop: 0, padding: '8px 20px', fontWeight: '700' }}
                >
                  {isCreatingOfficer ? 'Appointing...' : 'Appoint Taluka Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </main>
    </div>
  )
}
