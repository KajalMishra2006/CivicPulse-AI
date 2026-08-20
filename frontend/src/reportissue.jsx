import { useState } from 'react'

function ReportIssue({ onBack, onIssueSubmitted }) {
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState('')
    const [description, setDescription] = useState('')
    const [location, setLocation] = useState('')

    function handleSubmit(e) {
      e.preventDefault()

      const newIssue = {
        title,
        category,
        description,
        location
      }

      onIssueSubmitted(newIssue)
    }

    return (
      <div className="report-page">

        <div className="report-card">

          <button
            type="button"
            className="back-button"
            onClick={onBack}
          >
            ← Back to Dashboard
          </button>

          <h1>Report a Civic Issue</h1>

          <p>
            Tell us about the problem in your community.
          </p>

          <form onSubmit={handleSubmit}>

            <label>Issue Title</label>
            <input
              type="text"
              placeholder="Example: Large pothole on main road"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <label>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">Select Category</option>
              <option value="Roads">Roads & Potholes</option>
              <option value="Garbage">Garbage & Waste</option>
              <option value="Streetlight">Streetlights</option>
              <option value="Water">Water Supply</option>
              <option value="Drainage">Drainage</option>
              <option value="Electricity">Electricity</option>
              <option value="Other">Other</option>
            </select>

            <label>Description</label>
            <textarea
              placeholder="Describe the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="5"
              required
            />

            <label>Location</label>
            <input
              type="text"
              placeholder="Enter the location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />

            <button type="submit" className="primary-button">
              Submit Issue
            </button>

          </form>

        </div>

      </div>
    )
  }

  export default ReportIssue