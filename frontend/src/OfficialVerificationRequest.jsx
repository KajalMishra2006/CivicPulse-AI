import { useState, useMemo } from 'react'
import { registerOfficialApplicant } from './firebase/verification.js'
import { getAllStates, getDistrictsForState, getTalukasForDistrict } from './utils/locations.js'
import { useAuth } from './context/AuthContext.jsx'
import { auth, db } from './firebase/config.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import './App.css'

function OfficialVerificationRequest({ initialEmail = '', initialName = '', onBackToOfficialLogin }) {
  console.log('### CIVICPULSE VERIFICATION DEBUG BUILD ###')
  const { currentUser } = useAuth()

  const [name, setName] = useState(initialName || currentUser?.displayName || '')
  const [email, setEmail] = useState(initialEmail || currentUser?.email || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [organization, setOrganization] = useState('')
  const [department, setDepartment] = useState('')
  const [designation, setDesignation] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [employeeType, setEmployeeType] = useState('state_admin') // 'citizen_access_employee' | 'issue_resolution_employee' | 'district_admin' | 'state_admin'

  const isStateAdmin = employeeType === 'state_admin' || employeeType === 'STATE_ADMIN'
  const isDistrictAdmin = employeeType === 'district_admin' || employeeType === 'DISTRICT_ADMIN'

  const allStates = getAllStates()
  const [state, setState] = useState(allStates[0]?.name || 'Maharashtra')

  const districtList = useMemo(() => {
    return getDistrictsForState(state)
  }, [state])

  const [district, setDistrict] = useState('Pune')

  const talukaList = useMemo(() => {
    return getTalukasForDistrict(state, district)
  }, [state, district])

  const [taluka, setTaluka] = useState('Haveli')

  const [reason, setReason] = useState('')
  const [idFile, setIdFile] = useState(null)
  const [idPreview, setIdPreview] = useState(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedSuccess, setSubmittedSuccess] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e) {
    setError('')
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Please upload a valid image (JPEG, PNG, WebP) or PDF file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.')
      return
    }

    setIdFile(file)
    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file)
      setIdPreview(previewUrl)
    } else {
      setIdPreview(null)
    }
  }

  function handleRemoveFile() {
    setIdFile(null)
    if (idPreview) {
      URL.revokeObjectURL(idPreview)
      setIdPreview(null)
    }
  }

  async function handleDirectAddDocTest() {
    try {
      const user = auth.currentUser || currentUser
      if (!user) {
        alert('Authentication required: please fill out email & password or sign in before testing direct addDoc.')
        return
      }
      console.log('[DIRECT TEST] Attempting addDoc on verificationRequests...')
      const ref = await addDoc(
        collection(db, 'verificationRequests'),
        {
          userId: user.uid,
          applicantUid: user.uid,
          requestedRole: 'state_admin',
          employeeType: 'state_admin',
          status: 'pending',
          stateId: 'maharashtra',
          stateName: 'Maharashtra',
          name: 'DEBUG TEST',
          applicantName: 'DEBUG TEST',
          email: user.email || email.trim(),
          applicantEmail: user.email || email.trim(),
          createdAt: serverTimestamp()
        }
      )
      console.log('### TEST REQUEST CREATED ###', ref.id)
      alert(`### TEST REQUEST CREATED in Firestore with ID: ${ref.id} ###`)
    } catch (err) {
      console.error('### TEST REQUEST FAILED ###', err)
      alert(`### TEST REQUEST FAILED: ${err.code || 'UNKNOWN'} - ${err.message} ###`)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    console.log('[AUTH]')
    console.log('Current UID:', currentUser?.uid || 'Not signed in (creating new applicant session)')
    console.log('Current email:', currentUser?.email || email.trim())

    console.log('[VERIFICATION FORM]')
    console.log('Requested role:', employeeType)
    console.log('Employee type:', employeeType)
    console.log('State:', state)
    console.log('District:', isStateAdmin ? 'N/A (Statewide)' : district)
    console.log('Taluka:', (isStateAdmin || isDistrictAdmin) ? 'N/A' : taluka)

    console.log('[VERIFY] SUBMIT CLICKED')
    console.log('[VERIFY] currentUser:', currentUser?.uid || auth.currentUser?.uid)
    console.log('[VERIFY] email:', currentUser?.email || auth.currentUser?.email || email.trim())
    console.log('[VERIFY] requestedRole:', employeeType)
    console.log('[VERIFY] employeeType:', employeeType)
    console.log('[VERIFY] stateId:', state)
    console.log('[VERIFY] stateName:', state)
    console.log('[VERIFY] BEFORE createVerificationRequest()')

    if (!name.trim() || !email.trim() || !organization.trim() || !department.trim() || !employeeId.trim()) {
      setError('Please fill in all required official fields.')
      return
    }

    if (!currentUser) {
      if (!password || password.length < 8) {
        setError('Password must be at least 8 characters to secure your official applicant account.')
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter your password.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const result = await registerOfficialApplicant({
        name: name.trim(),
        email: email.trim(),
        password,
        mobileNumber: mobileNumber.trim(),
        organization: organization.trim(),
        department: department.trim(),
        designation: designation.trim(),
        employeeId: employeeId.trim(),
        state,
        district: isStateAdmin ? '' : district,
        taluka: (isStateAdmin || isDistrictAdmin) ? '' : taluka,
        employeeType,
        requestedRole: employeeType,
        reason: reason.trim(),
        idFile
      })

      console.log('[VERIFY] AFTER createVerificationRequest()')
      console.log('[VERIFY] REQUEST ID:', result?.id || result?.requestId)
      console.log('[FIRESTORE] Created request ID:', result?.id || result?.requestId)
      setSubmittedSuccess(true)
    } catch (err) {
      console.error('[VERIFICATION] Firestore request creation failed:', {
        code: err?.code,
        message: err?.message
      })
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. If you already created an account, please provide your existing password.')
      } else {
        setError(err.message || 'Failed to submit official verification request.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedSuccess) {
    return (
      <div className="signup-page">
        <div className="signup-card" style={{ textAlign: 'center', maxWidth: '540px' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>🏛️</div>
          <h2>Application Submitted for Review</h2>
          <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.6' }}>
            Your official access request for <strong>{name}</strong> as <strong>{employeeType.replace(/_/g, ' ')}</strong> in <strong>{taluka}, {district}, {state}</strong> has been securely submitted to the governing Administrator.
          </p>
          <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', margin: '16px 0', textAlign: 'left', fontSize: '13px', color: '#334155' }}>
            <p style={{ margin: '0 0 6px 0' }}><strong>Official Email:</strong> {email}</p>
            <p style={{ margin: '0 0 6px 0' }}><strong>Department:</strong> {department} ({employeeId})</p>
            <p style={{ margin: '0 0 6px 0' }}><strong>Jurisdiction:</strong> {taluka}, {district}, {state}</p>
            <p style={{ margin: 0, color: '#d97706', fontWeight: '700' }}>⏳ Status: PENDING ADMINISTRATIVE REVIEW</p>
          </div>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
            Once approved by the supervising Administrator, sign in with your official email and password to access the Government Operations dashboard.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={onBackToOfficialLogin}
            style={{ width: '100%' }}
          >
            ← Return to Government Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="signup-page">
      <div className="signup-card" style={{ maxWidth: '620px' }}>
        <button
          type="button"
          className="back-button-styled"
          onClick={onBackToOfficialLogin}
          style={{ marginBottom: '16px' }}
        >
          ← Back to Official Sign In
        </button>

        <h1>🏛️ Government Employee Access Request</h1>
        <p className="signup-description">
          Submit official credentials for hierarchical review and jurisdictional appointment.
        </p>

        {error && <p className="error-message main-error">{error}</p>}

        <form onSubmit={handleSubmit} noValidate>
          {/* FULL NAME, OFFICIAL EMAIL & MOBILE */}
          <div className="form-row-location">
            <div className="location-field">
              <label>Full Name *</label>
              <input
                type="text"
                placeholder="e.g. Officer Vikram Deshmukh"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="location-field">
              <label>Official Email *</label>
              <input
                type="email"
                placeholder="e.g. vikram.deshmukh@gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="location-field">
              <label>Mobile Number</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* PASSWORD FIELDS (if new applicant) */}
          {!currentUser && (
            <div className="form-row-2" style={{ marginTop: '10px' }}>
              <div className="location-field">
                <label>Create Official Password *</label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="location-field">
                <label>Confirm Password *</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {/* ROLE / EMPLOYEE TYPE */}
          <div className="location-field" style={{ marginTop: '10px' }}>
            <label>Requested Role Type *</label>
            <select
              value={employeeType}
              onChange={(e) => setEmployeeType(e.target.value)}
              disabled={isSubmitting}
              className="form-select"
              style={{ width: '100%', padding: '10px 14px' }}
            >
              <option value="state_admin">State Administrator (State Management)</option>
              <option value="district_admin">District Administrator (District Management)</option>
              <option value="citizen_access_employee">Taluka Citizen Access Employee (Citizen Verifications)</option>
              <option value="issue_resolution_employee">Taluka Issue Resolution Employee (Field Operations)</option>
            </select>
          </div>

          {/* GEOGRAPHIC JURISDICTION */}
          <div className="location-section" style={{ marginTop: '10px' }}>
            <div className="location-field">
              <label>State *</label>
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value)
                  const dists = getDistrictsForState(e.target.value)
                  const firstDist = dists[0]?.name || 'Pune'
                  setDistrict(firstDist)
                  const talukas = getTalukasForDistrict(e.target.value, firstDist)
                  setTaluka(talukas[0]?.name || 'Haveli')
                }}
                disabled={isSubmitting}
                className="form-select"
                style={{ width: '100%', padding: '10px 14px' }}
              >
                {allStates.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {!isStateAdmin && (
              <div className="location-field">
                <label>District *</label>
                <select
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value)
                    const talukas = getTalukasForDistrict(state, e.target.value)
                    setTaluka(talukas[0]?.name || 'Haveli')
                  }}
                  disabled={isSubmitting}
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  {districtList.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!isStateAdmin && !isDistrictAdmin && (
              <div className="location-field">
                <label>Taluka / Ward *</label>
                <select
                  value={taluka}
                  onChange={(e) => setTaluka(e.target.value)}
                  disabled={isSubmitting}
                  className="form-select"
                  style={{ width: '100%', padding: '10px 14px' }}
                >
                  {talukaList.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {isStateAdmin && (
              <div className="location-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: '8px', fontSize: '13px', color: '#475569', width: '100%', border: '1px solid #cbd5e1' }}>
                  🏛️ <strong>Jurisdiction:</strong> Statewide (All Districts & Talukas in {state})
                </div>
              </div>
            )}

            {isDistrictAdmin && (
              <div className="location-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: '8px', fontSize: '13px', color: '#475569', width: '100%', border: '1px solid #cbd5e1' }}>
                  🏙️ <strong>Jurisdiction:</strong> District-wide (All Talukas in {district})
                </div>
              </div>
            )}
          </div>

          {/* DEPARTMENT, DESIGNATION & EMPLOYEE ID */}
          <div className="form-row-location" style={{ marginTop: '10px' }}>
            <div className="location-field">
              <label>Department *</label>
              <input
                type="text"
                placeholder="e.g. Public Works (PWD)"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="location-field">
              <label>Designation</label>
              <input
                type="text"
                placeholder="e.g. Assistant Engineer"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="location-field">
              <label>Employee ID *</label>
              <input
                type="text"
                placeholder="e.g. GOV-PWD-8492"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* GOVERNMENT ORGANIZATION */}
          <div className="location-field" style={{ marginTop: '10px' }}>
            <label>Government Organization *</label>
            <input
              type="text"
              placeholder="e.g. Pune Municipal Corporation / Maharashtra Urban Development"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* GOVERNMENT ID CARD IMAGE UPLOAD */}
          <div style={{ marginTop: '14px', padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <label style={{ fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🛡️</span> Government Official ID Card Document
            </label>
            <p style={{ margin: '4px 0 10px 0', fontSize: '12px', color: '#64748b' }}>
              Upload official departmental identification card (image or PDF, max 5MB).
            </p>

            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="form-file-input"
            />

            {idPreview && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={idPreview} alt="Official ID Preview" style={{ maxHeight: '70px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                <button type="button" className="remove-image-btn" onClick={handleRemoveFile}>✕ Remove</button>
              </div>
            )}
          </div>

          {/* REASON FOR REQUEST */}
          <div className="location-field" style={{ marginTop: '12px' }}>
            <label>Reason for Requesting Access</label>
            <textarea
              rows="2"
              placeholder="e.g. Assigned to monitor civic grievances in Haveli Taluka..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              className="form-textarea"
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="primary-button"
            style={{ width: '100%', marginTop: '16px' }}
          >
            {isSubmitting ? 'Submitting Official Request...' : 'Submit Verification Request'}
          </button>

          <button
            type="button"
            onClick={handleDirectAddDocTest}
            className="secondary-button"
            style={{ width: '100%', marginTop: '8px', background: '#f8fafc', borderColor: '#cbd5e1', color: '#475569', fontSize: '13px' }}
          >
            🧪 Test Direct Firestore addDoc() Write
          </button>
        </form>
      </div>
    </div>
  )
}

export default OfficialVerificationRequest
