import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { createIssue } from './firebase/issues.js'
import './App.css'

function ReportIssue({ onBack, onIssueSubmitted }) {
  const { currentUser, userProfile } = useAuth()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [country, setCountry] = useState(userProfile?.country || 'India')
  const [stateVal, setStateVal] = useState(userProfile?.state || '')
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
        console.warn('Geolocation notice:', geoErr)
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

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, WebP, etc.)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image file size must be less than 5MB')
      return
    }

    setImageFile(file)
    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)
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

    if (!title.trim() || !category || !description.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    setIsSubmitting(true)
    try {
      const newIssue = await createIssue({
        title,
        category,
        description,
        country,
        state: stateVal,
        localArea,
        location,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
        imageFile,
        currentUser
      })

      if (onIssueSubmitted) {
        onIssueSubmitted(newIssue)
      }
    } catch (err) {
      console.error('[SUBMISSION ERROR]', err)
      setError(err.message || 'Failed to submit issue. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="report-page">
      <div className="report-page-container">
        <div className="back-button-container">
          <button
            type="button"
            className="back-button-styled"
            onClick={onBack}
            disabled={isSubmitting}
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="report-card">
          <h1 className="report-page-title">Report a Civic Issue</h1>

          <p className="report-page-subtitle">
            Tell us about the problem in your community.
          </p>

          {error && <p className="error-message main-error">{error}</p>}

          <form onSubmit={handleSubmit} className="report-issue-form">
            {/* ROW 1: Title | Category | Description */}
            <div className="form-row-top">
              <div className="form-group">
                <label className="form-label">
                  Issue Title <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Example: Broken streetlight / Deep crater on 5th Avenue"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Category <span className="required-star">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="form-select"
                >
                  <option value="">Select Category</option>
                  <option value="Roads">Roads & Potholes</option>
                  <option value="Garbage">Garbage & Sanitation</option>
                  <option value="Streetlight">Streetlights</option>
                  <option value="Water">Water Supply</option>
                  <option value="Drainage">Drainage & Flooding</option>
                  <option value="Electricity">Electricity & Power</option>
                  <option value="Other">Other Civic Issue</option>
                </select>
              </div>

              <div className="form-group form-group-description">
                <label className="form-label">
                  Description <span className="required-star">*</span>
                </label>
                <textarea
                  placeholder="Describe the issue in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="4"
                  required
                  disabled={isSubmitting}
                  className="form-textarea"
                />
              </div>
            </div>

            {/* ROW 2: Country | State | Local Area */}
            <div className="form-row-location">
              <div className="form-group">
                <label className="form-label">Country</label>
                <input
                  type="text"
                  placeholder="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={isSubmitting}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">State / Province</label>
                <input
                  type="text"
                  placeholder="State"
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  disabled={isSubmitting}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Local Area / Ward</label>
                <input
                  type="text"
                  placeholder="Neighborhood / Area"
                  value={localArea}
                  onChange={(e) => setLocalArea(e.target.value)}
                  disabled={isSubmitting}
                  className="form-input"
                />
              </div>
            </div>

            {/* ROW 3: Specific Address / Landmark */}
            <div className="form-group form-row-full">
              <label className="form-label">Specific Address / Landmark</label>
              <input
                type="text"
                placeholder="e.g. Near City Hospital Gate 2, Main Street"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isSubmitting}
                className="form-input"
              />
            </div>

            {/* ROW 4: GPS Coordinates Section */}
            <div className="gps-section-card">
              <div className="gps-header-row">
                <div className="gps-info">
                  <strong className="gps-title">GPS Coordinates (Optional)</strong>
                  <p className="gps-desc">
                    Capture your exact current coordinates to help municipal crews locate the issue.
                  </p>
                </div>

                <button
                  type="button"
                  className="gps-btn"
                  onClick={handleGetLocation}
                  disabled={geoLoading || isSubmitting}
                >
                  {geoLoading ? '📍 Locating...' : '📍 Use My Location'}
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

            {/* ROW 5: Photo Attachment Section */}
            <div className="form-group form-row-full form-photo-section">
              <label className="form-label">Attach Photo (Optional - max 5MB)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isSubmitting}
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
                    ✕ Remove Photo
                  </button>
                </div>
              )}
            </div>

            {/* ROW 6: Submit Issue Button */}
            <div className="form-submit-container">
              <button
                type="submit"
                className="submit-issue-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Uploading / Submitting Issue...' : 'Submit Issue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ReportIssue