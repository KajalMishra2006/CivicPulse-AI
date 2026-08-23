import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { auth, db } from './config.js'

/**
 * Rule-based priority scoring for civic complaints.
 * Can be upgraded to Gemini AI later.
 *
 * HIGH Priority (Score 80-100):
 * - Immediate safety hazards, collapsed structures, electric wires, gas leaks
 * - Water pipeline bursts, severe flooding, contaminated water supply
 * - Major road damage, sinkholes, missing manholes, hazardous intersections
 *
 * MEDIUM Priority (Score 50-79):
 * - Garbage & sanitation issues, overflowing dumpsters
 * - Broken or non-functioning streetlights, dark streets
 * - Moderate potholes, damaged sidewalks, blocked drain channels
 *
 * LOW Priority (Score 10-49):
 * - Minor cosmetic/civic problems, park maintenance, graffiti, bench repair, noise
 */
export function calculateIssuePriority(title = '', category = '', description = '') {
  const text = `${title} ${category} ${description}`.toLowerCase()

  const highKeywords = [
    'hazard', 'danger', 'emergency', 'electric', 'wire', 'shock', 'spark',
    'gas leak', 'fire', 'collapse', 'falling', 'sinkhole', 'manhole',
    'flood', 'flooding', 'burst', 'contamination', 'toxic', 'sewage',
    'accident', 'deep pothole', 'crater', 'bridge', 'structural',
    'traffic light broken', 'signal failure', 'hospital', 'school zone'
  ]

  const mediumKeywords = [
    'garbage', 'trash', 'waste', 'dump', 'dustbin', 'bin overflow',
    'streetlight', 'street light', 'lamp', 'dark', 'light not working',
    'pothole', 'road damage', 'cracked road', 'sidewalk', 'pavement',
    'drainage', 'water logging', 'leakage', 'leak', 'stagnant', 'mosquitoes',
    'speed breaker', 'signboard', 'animal'
  ]

  // Direct category matching
  const cat = (category || '').toLowerCase()
  if (cat.includes('emergency') || cat.includes('electricity') || (cat.includes('water') && (text.includes('burst') || text.includes('contamination')))) {
    return { priority: 'HIGH', priorityScore: 90 }
  }

  for (const kw of highKeywords) {
    if (text.includes(kw)) {
      return { priority: 'HIGH', priorityScore: 85 }
    }
  }

  for (const kw of mediumKeywords) {
    if (text.includes(kw)) {
      return { priority: 'MEDIUM', priorityScore: 60 }
    }
  }

  return { priority: 'LOW', priorityScore: 30 }
}

/**
 * Sort issues by Priority (HIGH > MEDIUM > LOW).
 * Within the same priority, older complaints appear first (FIFO).
 */
export function sortIssuesByPriority(issues = []) {
  const priorityWeight = {
    high: 3,
    medium: 2,
    low: 1
  }

  return [...issues].sort((a, b) => {
    const pA = priorityWeight[(a.priority || 'MEDIUM').toLowerCase()] || 2
    const pB = priorityWeight[(b.priority || 'MEDIUM').toLowerCase()] || 2

    // 1. Primary Sort: High priority first
    if (pB !== pA) {
      return pB - pA
    }

    // 2. Secondary Sort: Older complaints first within the same priority tier
    const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
    const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0)

    return timeA - timeB
  })
}

/**
 * Dedicated Free Image Storage solution for Hackathon MVP:
 * 1. Validates authenticated citizen user and 5MB size limit.
 * 2. Compresses image client-side to an optimized high-resolution Web Data URL (max 1024x1024, quality 0.75).
 * 3. Returns the valid image URL string to be saved directly in the Firestore issue document's `imageUrl` field.
 * 4. Zero paid plan requirements, zero storage quota restrictions, zero external API keys required.
 */
export async function uploadIssueImage(file, userId) {
  // If no file provided, skip upload completely
  if (!file) return null

  // 1. Verify auth.currentUser exists
  if (!auth.currentUser) {
    throw new Error('Authentication error: You must be logged in to upload an image.')
  }

  // 2. Verify userId === auth.currentUser.uid
  if (!userId || userId !== auth.currentUser.uid) {
    throw new Error(`Security validation failed: User ID mismatch (expected ${auth.currentUser.uid}, received ${userId}).`)
  }

  // 3. Verify file.type starts with "image/"
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Invalid file type: Only image files (JPEG, PNG, WebP, GIF) are allowed.')
  }

  // 4. Verify file.size <= 5 MB
  const MAX_SIZE_BYTES = 5 * 1024 * 1024
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File too large: Image size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB limit.`)
  }

  console.log('[IMAGE] Upload started', {
    name: file.name,
    size: file.size,
    type: file.type
  })

  console.log('[IMAGE] Storage initialized: Free MVP Image Storage (Optimized Web Data URL)')
  const timestamp = Date.now()
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const uploadPath = `issue_images/${userId}/${timestamp}_${safeFileName}`
  console.log('[IMAGE] Upload path: ' + uploadPath)

  // 30-second timeout promise
  let timeoutTimer
  const timeoutPromise = new Promise((_, reject) => {
    timeoutTimer = setTimeout(() => {
      const err = new Error('Image upload timed out. Please check Firebase Storage configuration and internet connection.')
      err.code = 'storage/upload-timeout'
      reject(err)
    }, 30000)
  })

  try {
    const processPromise = new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (readerEvent) => {
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const MAX_WIDTH = 1024
            const MAX_HEIGHT = 1024
            let width = img.width
            let height = img.height

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width)
                width = MAX_WIDTH
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = Math.round((width * MAX_HEIGHT) / height)
                height = MAX_HEIGHT
              }
            }

            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, width, height)

            // Compress to high-quality JPEG (~40-80KB)
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75)
            resolve(compressedDataUrl)
          } catch (canvasErr) {
            reject(new Error('Failed to process image canvas: ' + canvasErr.message))
          }
        }
        img.onerror = () => reject(new Error('Failed to load image for processing.'))
        img.src = readerEvent.target.result
      }
      reader.onerror = () => reject(new Error('Failed to read image file.'))
      reader.readAsDataURL(file)
    })

    const finalImageUrl = await Promise.race([processPromise, timeoutPromise])
    clearTimeout(timeoutTimer)

    console.log('[IMAGE] Upload completed', { path: uploadPath })
    console.log('[IMAGE] Download URL obtained (Free Web Data URL, length: ' + finalImageUrl.length + ')')

    return finalImageUrl
  } catch (err) {
    clearTimeout(timeoutTimer)
    console.error('[IMAGE ERROR] Upload failed:', {
      code: err.code || 'unknown',
      message: err.message || err.toString()
    })
    throw err
  }
}

/**
 * Create a new civic issue document in Firestore with automated priority scoring.
 * Citizens cannot manually pick priority.
 */
export async function createIssue({
  title,
  category,
  description,
  country = '',
  state = '',
  localArea = '',
  location = '',
  latitude = null,
  longitude = null,
  imageFile = null,
  currentUser
}) {
  if (!currentUser || !currentUser.uid) {
    throw new Error('You must be logged in to report an issue')
  }

  console.log('[ISSUE] Submission started', {
    title,
    category,
    hasImage: Boolean(imageFile),
    latitude,
    longitude,
    uid: currentUser.uid
  })

  // Only upload/process image if an image file was selected
  let imageUrl = null
  if (imageFile) {
    imageUrl = await uploadIssueImage(imageFile, currentUser.uid)
  }

  // Automated priority calculation
  const priorityResult = calculateIssuePriority(title, category, description)

  // Construct location string
  const locParts = [localArea, state, country].filter(Boolean)
  const finalLocation = location?.trim() || (locParts.length > 0 ? locParts.join(', ') : 'Not specified')

  const parsedLat = (latitude !== undefined && latitude !== null && !isNaN(Number(latitude))) ? Number(latitude) : null
  const parsedLng = (longitude !== undefined && longitude !== null && !isNaN(Number(longitude))) ? Number(longitude) : null

  const issueData = {
    userId: currentUser.uid,
    userEmail: currentUser.email || '',
    userName: currentUser.displayName || 'Civic User',
    title: (title || '').trim(),
    category: (category || '').trim(),
    description: (description || '').trim(),
    country: (country || '').trim(),
    state: (state || '').trim(),
    localArea: (localArea || '').trim(),
    location: finalLocation,
    latitude: parsedLat,
    longitude: parsedLng,
    imageUrl: imageUrl || null,
    priority: priorityResult.priority,
    priorityScore: priorityResult.priorityScore,
    status: 'Pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null
  }

  console.log('[ISSUE] Firestore create started', {
    title: issueData.title,
    category: issueData.category,
    priority: issueData.priority,
    hasImageUrl: Boolean(issueData.imageUrl)
  })

  try {
    const docRef = await addDoc(collection(db, 'issues'), issueData)
    console.log('[ISSUE] Firestore create completed', { id: docRef.id })
    console.log('[ISSUE] Submission completed')

    return { id: docRef.id, ...issueData }
  } catch (err) {
    console.error('[ISSUE ERROR] Firestore create failed:', { code: err.code, message: err.message, err })
    if (err.code === 'permission-denied') {
      throw new Error('Firestore permission denied: Your account cannot create this issue document. Please verify firestore.rules.')
    }
    throw err
  }
}

/**
 * Subscribe in real-time to all issues reported by a specific user.
 */
export function subscribeUserIssues(userId, onUpdate, onError) {
  if (!userId) {
    onUpdate([])
    return () => {}
  }

  const issuesQuery = query(
    collection(db, 'issues'),
    where('userId', '==', userId)
  )

  const unsubscribe = onSnapshot(
    issuesQuery,
    (snapshot) => {
      const issues = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
          return timeB - timeA
        })
      onUpdate(issues)
    },
    (error) => {
      console.error('Error fetching user issues:', error)
      if (onError) onError(error)
    }
  )

  return unsubscribe
}

/**
 * Compute statistics from an array of citizen issues.
 */
export function calculateIssueStats(issues = []) {
  const total = issues.length
  const resolved = issues.filter((i) => (i.status || '').toLowerCase() === 'resolved').length
  const inProgress = issues.filter((i) => (i.status || '').toLowerCase() === 'in progress').length
  const pending = issues.filter((i) => (i.status || 'Pending').toLowerCase() === 'pending').length

  return { total, resolved, inProgress, pending }
}

/**
 * Subscribe in real-time to ALL issues in Firestore (for Government Operations dashboard).
 */
export function subscribeAllIssues(onUpdate, onError) {
  const issuesCollection = collection(db, 'issues')

  const unsubscribe = onSnapshot(
    issuesCollection,
    (snapshot) => {
      const issues = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      // Apply default priority sorting (HIGH > MEDIUM > LOW, older first)
      const sortedIssues = sortIssuesByPriority(issues)
      onUpdate(sortedIssues)
    },
    (error) => {
      console.error('Error fetching all issues:', error)
      if (onError) onError(error)
    }
  )

  return unsubscribe
}

/**
 * Update an issue's status in Firestore (used by Government Officials and Admins).
 */
export async function updateIssueStatus(issueId, newStatus, officialUid = '') {
  if (!issueId) throw new Error('Issue ID is required')
  const issueRef = doc(db, 'issues', issueId)

  const effectiveUid = officialUid || auth.currentUser?.uid || ''

  const updateData = {
    status: newStatus,
    updatedAt: serverTimestamp()
  }

  if (newStatus === 'Resolved') {
    updateData.resolvedAt = serverTimestamp()
    if (effectiveUid) {
      updateData.resolvedBy = effectiveUid
    }
  } else if (newStatus === 'In Progress') {
    updateData.resolvedAt = null
    updateData.resolvedBy = null
  } else if (newStatus === 'Pending') {
    updateData.resolvedAt = null
    updateData.resolvedBy = null
  }

  await updateDoc(issueRef, updateData)
}

/**
 * Compute comprehensive statistics for the Government Operations Dashboard.
 */
export function calculateOfficialStats(issues = []) {
  const total = issues.length
  const highPriority = issues.filter((i) => (i.priority || 'MEDIUM').toUpperCase() === 'HIGH').length
  const mediumPriority = issues.filter((i) => (i.priority || 'MEDIUM').toUpperCase() === 'MEDIUM').length
  const lowPriority = issues.filter((i) => (i.priority || 'MEDIUM').toUpperCase() === 'LOW').length

  const pending = issues.filter((i) => (i.status || 'Pending').toLowerCase() === 'pending').length
  const inProgress = issues.filter((i) => (i.status || '').toLowerCase() === 'in progress').length
  const resolved = issues.filter((i) => (i.status || '').toLowerCase() === 'resolved').length

  return { total, highPriority, mediumPriority, lowPriority, pending, inProgress, resolved }
}
