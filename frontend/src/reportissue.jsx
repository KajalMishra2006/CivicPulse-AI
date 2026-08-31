import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { createIssue } from './firebase/issues.js'
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  startVoiceRecognition,
  requestMicrophonePermission,
  playTextToSpeech,
  stopTextToSpeech,
  getLanguageMetadata
} from './utils/speech.js'
import { getTranslation } from './utils/translations.js'
import { getAllStates, getDistrictsForState, getTalukasForDistrict } from './utils/locations.js'
import LanguageSelector from './LanguageSelector.jsx'
import './App.css'

function ReportIssue({ onBack, onIssueSubmitted }) {
  const { currentUser, userProfile, preferredLanguage, setLanguage } = useAuth()
  const activeLanguage = preferredLanguage || userProfile?.preferredLanguage || 'English'
  const t = getTranslation(activeLanguage)
  const langMeta = getLanguageMetadata(activeLanguage)

  const isCitizenVerified =
    userProfile?.identityVerificationStatus === 'verified' ||
    userProfile?.verified === true ||
    userProfile?.role === 'issue_resolution_employee' ||
    userProfile?.role === 'citizen_access_employee' ||
    userProfile?.role === 'district_admin' ||
    userProfile?.role === 'state_admin' ||
    userProfile?.role === 'super_admin' ||
    userProfile?.role === 'admin'

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const country = userProfile?.country || 'India'

  const allStates = getAllStates()
  const [stateVal, setStateVal] = useState(userProfile?.stateName || userProfile?.state || 'Maharashtra')

  const districtList = useMemo(() => {
    return getDistrictsForState(stateVal)
  }, [stateVal])

  const [districtVal, setDistrictVal] = useState(userProfile?.districtName || userProfile?.district || 'Pune')

  const talukaList = useMemo(() => {
    return getTalukasForDistrict(stateVal, districtVal)
  }, [stateVal, districtVal])

  const [talukaVal, setTalukaVal] = useState(userProfile?.talukaName || userProfile?.taluka || 'Haveli')

  const [localArea, setLocalArea] = useState(userProfile?.localArea || '')
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoMessage, setGeoMessage] = useState('')
  const [geoError, setGeoError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Speech Recognition State Machine: 'normal' | 'listening' | 'success' | 'error'
  const [micState, setMicState] = useState('normal')
  const [speechMessage, setSpeechMessage] = useState('')
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const recognitionRef = useRef(null)
  const successTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
      }
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
      }
      stopTextToSpeech()
    }
  }, [])

  async function handleToggleVoiceInput() {
    setSpeechMessage('')

    if (micState === 'listening') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // ignore
        }
      }
      setMicState('normal')
      return
    }

    if (!isSpeechRecognitionSupported()) {
      setMicState('error')
      setSpeechMessage('Voice recognition is not supported in this browser. Please use Chrome/Edge or type your complaint.')
      return
    }

    try {
      await requestMicrophonePermission()
    } catch (permErr) {
      if (permErr.code === 'not-allowed') {
        setMicState('error')
        setSpeechMessage('Microphone permission is required for voice reporting.')
        return
      }
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // ignore
        }
      }

      const recognition = startVoiceRecognition({
        languageName: activeLanguage,
        onStart: () => {
          setMicState('listening')
          setSpeechMessage('')
        },
        onResult: ({ combinedText }) => {
          if (combinedText) {
            setDescription(combinedText)
          }
        },
        onError: (err) => {
          if (import.meta.env?.DEV) console.warn('[VOICE ERROR]', err)
          setMicState('error')
          setSpeechMessage(err.message || 'Microphone unavailable.')
        },
        onEnd: ({ finalText }) => {
          if (finalText && finalText.trim().length > 0) {
            setMicState('success')
            setSpeechMessage('✓ Voice captured')
            successTimerRef.current = setTimeout(() => {
              setMicState('normal')
              setSpeechMessage('')
            }, 3500)
          } else {
            setMicState('normal')
          }
        }
      })

      recognitionRef.current = recognition
    } catch (err) {
      if (import.meta.env?.DEV) console.error('Failed to initialize speech recognition:', err)
      setMicState('error')
      setSpeechMessage('Could not start voice recognition. Please try again or type manually.')
    }
  }

  function handleTogglePlayAudio() {
    if (isPlayingAudio) {
      stopTextToSpeech()
      setIsPlayingAudio(false)
      return
    }

    const textToSpeak = description ? description.trim() : ''
    if (!textToSpeak) return

    playTextToSpeech({
      text: textToSpeak,
      languageName: activeLanguage,
      onStart: () => setIsPlayingAudio(true),
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false)
    })
  }

  function handleGetLocation() {
    setGeoError('')
    setGeoMessage('')

    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser. You can enter your location manually.')
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setCoords({ latitude: lat, longitude: lng })
        setGeoMessage(`✓ GPS Location Captured (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        setGeoLoading(false)
      },
      (geoErr) => {
        if (import.meta.env?.DEV) console.warn('Geolocation notice:', geoErr)
        let msg = 'Could not access device location. You can enter your location manually.'
        if (geoErr.code === 1) {
          msg = 'Location permission was denied. Please enter your location manually below.'
        } else if (geoErr.code === 2) {
          msg = 'Device position is currently unavailable. Please enter your location manually.'
        } else if (geoErr.code === 3) {
          msg = 'Location request timed out. Please enter your location manually.'
        }
        setGeoError(msg)
        setGeoLoading(false)
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000
      }
    )
  }

  function handleImageChange(e) {
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

    setImageFile(file)
    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file)
      setImagePreview(previewUrl)
    } else {
      setImagePreview(null)
    }
  }

  function handleRemoveImage() {
    setImageFile(null)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!isCitizenVerified) {
      setError('Your account is pending verification by the Citizen Access Employee of your taluka. You will be able to submit complaints once verified.')
      return
    }

    if (!title.trim() || !category || !description.trim()) {
      setError(t.allFieldsRequired || 'Please fill in all required fields.')
      return
    }

    setIsSubmitting(true)
    try {
      const newIssue = await createIssue({
        title,
        category,
        description,
        preferredLanguage: activeLanguage,
        country,
        state: stateVal,
        district: districtVal,
        taluka: talukaVal,
        localArea,
        location,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
        imageFile,
        currentUser,
        userProfile
      })

      if (onIssueSubmitted) {
        onIssueSubmitted(newIssue)
      }
    } catch (err) {
      if (import.meta.env?.DEV) console.error('[SUBMISSION ERROR]', err)
      setError(err.message || 'Failed to submit issue. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="report-page">
      <div className="report-page-container">
        {/* Top bar with Back button and Language Selector */}
        <div className="report-nav-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <button
            type="button"
            className="back-button-styled"
            onClick={onBack}
            disabled={isSubmitting}
          >
            ← {t.backToDashboard || 'Back to Dashboard'}
          </button>

          <LanguageSelector
            currentLanguage={activeLanguage}
            onSelectLanguage={setLanguage}
            variant="dark"
            label={t.language || 'Language'}
          />
        </div>

        {/* Verification Status Warning if not verified */}
        {!isCitizenVerified && (
          <div style={{ margin: '0 0 20px 0', padding: '14px 18px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '10px', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>⏳</span>
            <div>
              <strong style={{ display: 'block', fontSize: '14px' }}>Citizen Verification Required</strong>
              <span style={{ fontSize: '13px' }}>
                Your account is currently under review by the Citizen Access Employee of {talukaVal} Taluka. Issue submission will be unlocked upon approval.
              </span>
            </div>
          </div>
        )}

        <div className="report-card">
          <h1 className="report-page-title">{t.reportPageTitle || 'Report a Civic Issue'}</h1>

          <p className="report-page-subtitle">
            {t.reportPageSubtitle || 'Tell us about the problem in your community.'}
          </p>

          {error && <p className="error-message main-error">{error}</p>}

          <form onSubmit={handleSubmit} className="report-issue-form">
            {/* ROW 1: Title & Category */}
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">
                  {t.issueTitle || 'Issue Title'} <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t.issueTitlePlaceholder || 'Example: Broken streetlight / Deep crater on Main Road'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isSubmitting || !isCitizenVerified}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {t.category || 'Category'} <span className="required-star">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  disabled={isSubmitting || !isCitizenVerified}
                  className="form-select"
                >
                  <option value="">{t.selectCategory || 'Select Category'}</option>
                  <option value="Roads">{t.roadsPotholes || 'Roads & Potholes'}</option>
                  <option value="Garbage">{t.garbageSanitation || 'Garbage & Sanitation'}</option>
                  <option value="Streetlight">{t.streetlights || 'Streetlights'}</option>
                  <option value="Water">{t.waterSupply || 'Water Supply'}</option>
                  <option value="Drainage">{t.drainageFlooding || 'Drainage & Flooding'}</option>
                  <option value="Electricity">{t.electricityPower || 'Electricity & Power'}</option>
                  <option value="Other">{t.otherCivic || 'Other Civic Issue'}</option>
                </select>
              </div>
            </div>

            {/* VOICE COMPLAINT SECTION WITH 4 STATES */}
            <div className={`voice-complaint-box ${micState === 'listening' ? 'recording-active' : ''}`}>
              <div className="voice-box-header">
                <div className="voice-box-text">
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🎤</span> {t.voiceComplaintTitle || 'Voice Complaint'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                    {t.voiceComplaintSubtitle || `Tap the microphone and speak your complaint in ${langMeta.nativeName}.`}
                  </p>
                </div>

                <div className="voice-box-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleToggleVoiceInput}
                    disabled={isSubmitting || !isCitizenVerified}
                    className={`btn-voice-mic ${micState === 'listening' ? 'is-recording' : ''}`}
                    aria-label={micState === 'listening' ? 'Stop recording voice complaint' : 'Start speaking voice complaint'}
                  >
                    <span className="mic-icon" aria-hidden="true">🎤</span>
                    <span>
                      {micState === 'listening' && '🔴 Listening... Tap to stop'}
                      {micState === 'success' && '✓ Voice captured'}
                      {micState === 'error' && '⚠️ Microphone unavailable'}
                      {micState === 'normal' && (t.speakComplaint || 'Speak in ' + langMeta.name)}
                    </span>
                  </button>

                  {isSpeechSynthesisSupported() && description.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={handleTogglePlayAudio}
                      disabled={isSubmitting}
                      className="btn-tts-listen"
                      aria-label={isPlayingAudio ? 'Stop reading description' : 'Listen to description aloud'}
                    >
                      <span>{isPlayingAudio ? (t.stopReading || '⏹️ Stop') : (t.listenAudio || '🔊 Listen')}</span>
                    </button>
                  )}
                </div>
              </div>

              {micState === 'listening' && (
                <div className="listening-indicator-row">
                  <div className="pulse-dot"></div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626' }}>
                    🔴 {t.listening || 'Listening... Speak now'} ({langMeta.nativeName})
                  </span>
                </div>
              )}

              {speechMessage && (
                <p style={{ fontSize: '12px', color: micState === 'success' ? '#16a34a' : '#ef4444', margin: '8px 0 0 0', fontWeight: '600' }}>
                  {speechMessage}
                </p>
              )}
            </div>

            {/* DESCRIPTION TEXTAREA */}
            <div className="form-group form-group-description">
              <label className="form-label">
                {t.description || 'Description'} <span className="required-star">*</span>
              </label>
              <textarea
                placeholder={t.descriptionPlaceholder || 'Describe the issue in detail or speak using the microphone above...'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="4"
                required
                disabled={isSubmitting || !isCitizenVerified}
                className="form-textarea"
              />
            </div>

            {/* ROW 3: State | District | Taluka | Ward */}
            <div className="form-row-location">
              <div className="form-group">
                <label className="form-label">{t.state || 'State'}</label>
                <select
                  value={stateVal}
                  onChange={(e) => {
                    setStateVal(e.target.value)
                    const dists = getDistrictsForState(e.target.value)
                    const firstDist = dists[0]?.name || 'Pune'
                    setDistrictVal(firstDist)
                    const talukas = getTalukasForDistrict(e.target.value, firstDist)
                    setTalukaVal(talukas[0]?.name || 'Haveli')
                  }}
                  disabled={isSubmitting || !isCitizenVerified}
                  className="form-select"
                >
                  {allStates.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">District</label>
                <select
                  value={districtVal}
                  onChange={(e) => {
                    setDistrictVal(e.target.value)
                    const talukas = getTalukasForDistrict(stateVal, e.target.value)
                    setTalukaVal(talukas[0]?.name || 'Haveli')
                  }}
                  disabled={isSubmitting || !isCitizenVerified}
                  className="form-select"
                >
                  {districtList.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Taluka / Ward</label>
                <select
                  value={talukaVal}
                  onChange={(e) => setTalukaVal(e.target.value)}
                  disabled={isSubmitting || !isCitizenVerified}
                  className="form-select"
                >
                  {talukaList.map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t.localArea || 'Neighborhood / Ward'}</label>
                <input
                  type="text"
                  placeholder={t.enterLocalArea || 'Neighborhood / Ward'}
                  value={localArea}
                  onChange={(e) => setLocalArea(e.target.value)}
                  disabled={isSubmitting || !isCitizenVerified}
                  className="form-input"
                />
              </div>
            </div>

            {/* ROW 4: Specific Address / Landmark */}
            <div className="form-group form-row-full">
              <label className="form-label">{t.addressLandmark || 'Specific Address / Landmark'}</label>
              <input
                type="text"
                placeholder={t.addressPlaceholder || 'e.g. Near City Hospital Gate 2, Main Street'}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isSubmitting || !isCitizenVerified}
                className="form-input"
              />
            </div>

            {/* ROW 5: GPS Coordinates Section */}
            <div className="gps-section-card">
              <div className="gps-header-row">
                <div className="gps-info">
                  <strong className="gps-title">{t.gpsCoordinates || 'GPS Coordinates (Optional)'}</strong>
                  <p className="gps-desc">
                    {t.gpsDesc || 'Capture your exact current coordinates to help municipal crews locate the issue.'}
                  </p>
                </div>

                <button
                  type="button"
                  className="gps-btn"
                  onClick={handleGetLocation}
                  disabled={geoLoading || isSubmitting || !isCitizenVerified}
                >
                  {geoLoading ? `📍 ${t.locating || 'Locating...'}` : `📍 ${t.useMyLocation || 'Use My Location'}`}
                </button>
              </div>

              {geoMessage && (
                <div className="gps-status-success">
                  {geoMessage}
                </div>
              )}

              {geoError && (
                <div className="gps-status-notice">
                  ℹ️ {geoError}
                </div>
              )}
            </div>

            {/* ROW 6: Photo Attachment Section */}
            <div className="form-group form-row-full form-photo-section">
              <label className="form-label">{t.attachPhoto || 'Attach Photo (Optional - max 5MB)'}</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleImageChange}
                disabled={isSubmitting || !isCitizenVerified}
                className="form-file-input"
              />

              {imagePreview && (
                <div className="image-preview-container">
                  <img
                    src={imagePreview}
                    alt="Selected issue preview"
                    className="image-preview"
                  />
                  <button
                    type="button"
                    className="remove-image-btn"
                    onClick={handleRemoveImage}
                    disabled={isSubmitting}
                  >
                    ✕ {t.removePhoto || 'Remove Photo'}
                  </button>
                </div>
              )}
            </div>

            {/* ROW 7: Submit Issue Button */}
            <div className="form-submit-container">
              <button
                type="submit"
                className="submit-issue-btn"
                disabled={isSubmitting || !isCitizenVerified}
              >
                {isSubmitting ? (t.submittingIssue || 'Uploading / Submitting Issue...') : (t.submitIssueBtn || 'Submit Issue')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ReportIssue