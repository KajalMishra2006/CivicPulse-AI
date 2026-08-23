import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { createIssue } from './firebase/issues.js'

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
      <div className="report-card">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          disabled={isSubmitting}
        >
          ← Back to Dashboard
        </button>

        <h1>Report a Civic Issue</h1>

        <p>
          Tell us about the problem in your community.
        </p>

        {error && <p className="error-message main-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label>Issue Title *</label>
          <input
            type="text"
            placeholder="Example: Broken streetlight / Deep crater on 5th Avenue"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <label>Category *</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            disabled={isSubmitting}
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

          <label>Description *</label>
          <textarea
            placeholder="Describe the issue in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
            required
            disabled={isSubmitting}
          />

          {/* Regional Area Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '8px' }}>
            <div>
              <label>Country</label>
              <input
                type="text"
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label>State / Province</label>
              <input
                type="text"
                placeholder="State"
                value={stateVal}
                onChange={(e) => setStateVal(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label>Local Area / Ward</label>
              <input
                type="text"
                placeholder="Neighborhood / Area"
                value={localArea}
                onChange={(e) => setLocalArea(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <label>Specific Address / Landmark</label>
          <input
            type="text"
            placeholder="e.g. Near City Hospital Gate 2, Main Street"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={isSubmitting}
          />

          {/* Geolocation Section */}
          <div style={{ margin: '14px 0', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>GPS Coordinates (Optional)</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Capture your exact current coordinates to help municipal crews locate the issue.
                </p>
              </div>

              <button
                type="button"
                className="filter-btn"
                style={{ background: '#0284c7', color: 'white', borderColor: '#0284c7', padding: '6px 14px', fontSize: '12px' }}
                onClick={handleGetLocation}
                disabled={geoLoading || isSubmitting}
              >
                {geoLoading ? '📍 Locating...' : '📍 Use My Location'}
              </button>
            </div>

            {geoMessage && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#059669', fontWeight: '600' }}>
                {geoMessage}
              </div>
            )}

            {geoError && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#d97706', fontWeight: '500' }}>
                ℹ️ {geoError}
              </div>
            )}
          </div>

          {/* Photo Attachment Section */}
          <div style={{ margin: '14px 0' }}>
            <label>Attach Photo (Optional - max 5MB)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={isSubmitting}
            />

            {imagePreview && (
              <div className="image-preview-container" style={{ marginTop: '10px' }}>
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

          <button
            type="submit"
            className="primary-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Uploading / Submitting Issue...' : 'Submit Issue'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ReportIssue