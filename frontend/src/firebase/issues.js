import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore'
import { auth, db } from './config.js'
import { resolveLocationMetadata } from '../utils/locations.js'

export const ISSUE_GROUP_RADIUS_METERS = 100

/**
 * Calculates great-circle distance between two GPS coordinates in meters (Haversine formula).
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null || lat1 === undefined || isNaN(Number(lat1)) ||
    lon1 === null || lon1 === undefined || isNaN(Number(lon1)) ||
    lat2 === null || lat2 === undefined || isNaN(Number(lat2)) ||
    lon2 === null || lon2 === undefined || isNaN(Number(lon2))
  ) {
    return Infinity
  }

  const R = 6371e3 // Earth radius in meters
  const phi1 = (Number(lat1) * Math.PI) / 180
  const phi2 = (Number(lat2) * Math.PI) / 180
  const deltaPhi = ((Number(lat2) - Number(lat1)) * Math.PI) / 180
  const deltaLambda = ((Number(lon2) - Number(lon1)) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Rule-based priority scoring for civic complaints.
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
 * Sort issues strictly:
 * 1. Primary: priorityScore DESCENDING (100 -> 0)
 * 2. Secondary: createdAt DESCENDING (newest timestamp first)
 */
export function getTimestampMs(createdAt) {
  if (!createdAt) return 0
  if (createdAt.seconds) return createdAt.seconds * 1000 + (createdAt.nanoseconds ? createdAt.nanoseconds / 1000000 : 0)
  if (createdAt.toDate && typeof createdAt.toDate === 'function') return createdAt.toDate().getTime()
  if (createdAt instanceof Date) return createdAt.getTime()
  const parsed = new Date(createdAt).getTime()
  return isNaN(parsed) ? 0 : parsed
}

export function sortIssuesByPriority(issues = []) {
  return [...issues].sort((a, b) => {
    const scoreA = typeof a.priorityScore === 'number' ? a.priorityScore : (Number(a.priorityScore) || 50)
    const scoreB = typeof b.priorityScore === 'number' ? b.priorityScore : (Number(b.priorityScore) || 50)

    if (scoreB !== scoreA) {
      return scoreB - scoreA
    }

    const timeA = getTimestampMs(a.createdAt)
    const timeB = getTimestampMs(b.createdAt)
    return timeB - timeA
  })
}

/**
 * Image storage compressor for Hackathon MVP.
 */
export async function uploadIssueImage(file, userId) {
  if (!file) return null

  if (!auth.currentUser) {
    throw new Error('Authentication error: You must be logged in to upload an image.')
  }

  if (!userId || userId !== auth.currentUser.uid) {
    throw new Error(`Security validation failed: User ID mismatch.`)
  }

  if (!file.type || (!file.type.startsWith('image/') && file.type !== 'application/pdf')) {
    throw new Error('Invalid file type: Only images and PDF files are allowed.')
  }

  const MAX_SIZE_BYTES = 5 * 1024 * 1024
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File too large: File size exceeds the 5 MB limit.`)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (readerEvent) => {
      if (file.type === 'application/pdf') {
        resolve(readerEvent.target.result)
        return
      }

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

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75)
          resolve(compressedDataUrl)
        } catch (canvasErr) {
          reject(new Error('Failed to process image: ' + canvasErr.message))
        }
      }
      img.onerror = () => reject(new Error('Failed to load image for processing.'))
      img.src = readerEvent.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.readAsDataURL(file)
  })
}

/**
 * Searches Firestore for an existing active civic issue cluster nearby (within 100m)
 * with the same category.
 */
export async function findExistingIssueGroup(category, latitude, longitude, radiusMeters = ISSUE_GROUP_RADIUS_METERS, locationMeta = null) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined || !category) {
    return null
  }

  console.log('[ISSUE GROUP CHECK]', {
    uid: auth.currentUser?.uid || 'anonymous',
    category,
    latitude,
    longitude,
    stateId: locationMeta?.stateId || null,
    districtId: locationMeta?.districtId || null,
    talukaId: locationMeta?.talukaId || null
  })

  try {
    const activeQuery = query(
      collection(db, 'issues'),
      where('status', 'in', ['Pending', 'In Progress', 'pending', 'in progress'])
    )
    const issuesSnap = await getDocs(activeQuery)
    const activeGroups = issuesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((issue) => {
        const status = String(issue.status || 'Pending').toLowerCase()
        return status !== 'resolved' && status !== 'rejected'
      })

    let closest = null
    let minDistance = Infinity

    for (const group of activeGroups) {
      if (String(group.category || '').toLowerCase().trim() !== String(category).toLowerCase().trim()) {
        continue
      }

      const dist = calculateDistanceMeters(latitude, longitude, group.latitude, group.longitude)
      if (dist <= radiusMeters && dist < minDistance) {
        minDistance = dist
        closest = {
          ...group,
          matchDistanceMeters: Math.round(dist)
        }
      }
    }

    return closest
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[GROUPING NOTICE] Error checking existing groups:', err)
    return null
  }
}

/**
 * Create a new civic issue report with automatic clustering and deduplication.
 */
export async function createIssue({
  title,
  category,
  description,
  preferredLanguage = 'English',
  country = 'India',
  state = 'Maharashtra',
  district = 'Pune',
  taluka = 'Haveli',
  localArea = '',
  location = '',
  latitude = null,
  longitude = null,
  imageFile = null,
  currentUser,
  userProfile = null
}) {
  if (!currentUser || !currentUser.uid) {
    throw new Error('You must be logged in to report an issue.')
  }

  // Enforce Citizen Verification Check: citizen cannot submit complaints until verified
  const isCitizenVerified =
    userProfile?.identityVerificationStatus === 'verified' ||
    userProfile?.verified === true ||
    userProfile?.role === 'issue_resolution_employee' ||
    userProfile?.role === 'citizen_access_employee' ||
    userProfile?.role === 'district_admin' ||
    userProfile?.role === 'state_admin' ||
    userProfile?.role === 'super_admin' ||
    userProfile?.role === 'admin'

  if (!isCitizenVerified) {
    throw new Error('Your account is pending verification by the Citizen Access Employee of your taluka. You will be able to submit complaints once verified.')
  }

  let imageUrl = null
  if (imageFile) {
    imageUrl = await uploadIssueImage(imageFile, currentUser.uid)
  }

  const priorityResult = calculateIssuePriority(title, category, description)
  const geo = resolveLocationMetadata({
    state: state || userProfile?.state || 'Maharashtra',
    district: district || userProfile?.district || 'Pune',
    taluka: taluka || userProfile?.taluka || 'Haveli'
  })

  const locParts = [localArea, geo.talukaName, geo.districtName, geo.stateName, country].filter(Boolean)
  const finalLocation = location?.trim() || (locParts.length > 0 ? locParts.join(', ') : 'Not specified')

  const parsedLat = (latitude !== undefined && latitude !== null && !isNaN(Number(latitude))) ? Number(latitude) : null
  const parsedLng = (longitude !== undefined && longitude !== null && !isNaN(Number(longitude))) ? Number(longitude) : null

  // Check for existing matching cluster nearby
  const existingGroup = await findExistingIssueGroup(category, parsedLat, parsedLng, ISSUE_GROUP_RADIUS_METERS, geo)

  const reportPayload = {
    userId: currentUser.uid,
    userEmail: currentUser.email || '',
    userName: currentUser.displayName || 'Citizen',
    title: (title || '').trim(),
    category: (category || '').trim(),
    originalDescription: (description || '').trim(),
    preferredLanguage: preferredLanguage || 'English',
    country: (country || 'India').trim(),
    stateId: geo.stateId,
    stateName: geo.stateName,
    state: geo.stateName,
    districtId: geo.districtId,
    districtName: geo.districtName,
    district: geo.districtName,
    talukaId: geo.talukaId,
    talukaName: geo.talukaName,
    taluka: geo.talukaName,
    localArea: (localArea || userProfile?.localArea || '').trim(),
    location: finalLocation,
    latitude: parsedLat,
    longitude: parsedLng,
    imageUrl: imageUrl || null,
    createdAt: serverTimestamp()
  }

  if (existingGroup) {
    // ATTACH TO EXISTING CLUSTER
    const clusterId = existingGroup.issueClusterId || existingGroup.groupId || existingGroup.id
    const groupRef = doc(db, 'issues', clusterId)
    const currentCount = Number(existingGroup.reportCount) || 1
    const newCount = currentCount + 1

    // Add report into the cluster's reports subcollection
    const reportRef = await addDoc(collection(db, 'issues', clusterId, 'reports'), reportPayload)

    // Update cluster document with incremented reportCount, participantUserIds, and updated timestamp
    try {
      await updateDoc(groupRef, {
        reportCount: newCount,
        participantUserIds: arrayUnion(currentUser.uid),
        updatedAt: serverTimestamp()
      })
    } catch (uErr) {
      console.warn('[CLUSTER UPDATE NOTICE]', uErr)
    }

    // Write user issue reference for the reporting citizen
    try {
      await setDoc(doc(db, 'userIssueReferences', currentUser.uid, 'issues', clusterId), {
        clusterId,
        reportId: reportRef.id,
        userId: currentUser.uid,
        status: existingGroup.status || 'Pending',
        priority: existingGroup.priority || 'Medium',
        priorityScore: existingGroup.priorityScore || 50,
        title: existingGroup.title || title,
        category: existingGroup.category || category,
        stateId: geo.stateId,
        districtId: geo.districtId,
        talukaId: geo.talukaId,
        createdAt: serverTimestamp()
      })
    } catch (refErr) {
      console.warn('[USER REFERENCE WRITE NOTICE]', refErr)
    }

    return {
      id: clusterId,
      reportId: reportRef.id,
      issueClusterId: clusterId,
      groupId: clusterId,
      isGrouped: true,
      reportCount: newCount,
      ...existingGroup
    }
  }

  // CREATE NEW CONSOLIDATED ISSUE CLUSTER
  const newGroupData = {
    userId: currentUser.uid,
    participantUserIds: [currentUser.uid],
    userEmail: currentUser.email || '',
    userName: currentUser.displayName || 'Citizen',
    title: (title || '').trim(),
    category: (category || '').trim(),
    description: (description || '').trim(),
    preferredLanguage: preferredLanguage || 'English',
    country: (country || 'India').trim(),
    stateId: geo.stateId,
    stateName: geo.stateName,
    state: geo.stateName,
    districtId: geo.districtId,
    districtName: geo.districtName,
    district: geo.districtName,
    talukaId: geo.talukaId,
    talukaName: geo.talukaName,
    taluka: geo.talukaName,
    localArea: (localArea || userProfile?.localArea || '').trim(),
    location: finalLocation,
    latitude: parsedLat,
    longitude: parsedLng,
    imageUrl: imageUrl || null,
    priority: priorityResult.priority,
    priorityScore: priorityResult.priorityScore,
    status: 'Pending',
    reportCount: 1,
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    resolutionNotes: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null
  }

  const docRef = await addDoc(collection(db, 'issues'), newGroupData)
  const newClusterId = docRef.id

  await updateDoc(docRef, {
    issueClusterId: newClusterId,
    groupId: newClusterId
  })

  await setDoc(doc(db, 'issues', newClusterId, 'reports', newClusterId), {
    ...reportPayload,
    reportId: newClusterId
  })

  try {
    await setDoc(doc(db, 'userIssueReferences', currentUser.uid, 'issues', newClusterId), {
      clusterId: newClusterId,
      reportId: newClusterId,
      userId: currentUser.uid,
      status: 'Pending',
      priority: priorityResult.priority,
      priorityScore: priorityResult.priorityScore,
      title: (title || '').trim(),
      category: (category || '').trim(),
      stateId: geo.stateId,
      districtId: geo.districtId,
      talukaId: geo.talukaId,
      createdAt: serverTimestamp()
    })
  } catch (refErr) {
    console.warn('[USER REFERENCE WRITE NOTICE]', refErr)
  }

  return {
    id: newClusterId,
    issueClusterId: newClusterId,
    groupId: newClusterId,
    reportCount: 1,
    ...newGroupData
  }
}

/**
 * Fetch all citizen reports associated with a specific issue cluster.
 */
export async function getIssueGroupReports(groupId) {
  if (!groupId) return []

  try {
    const reportsSnap = await getDocs(collection(db, 'issues', groupId, 'reports'))
    if (reportsSnap.empty) {
      return []
    }

    const reports = reportsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }))

    reports.sort((a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt))
    return reports
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[REPORTS FETCH ERROR]', err)
    return []
  }
}

/**
 * Subscribe to citizen's own issues with real-time canonical status reflection.
 */
export function subscribeUserIssues(userId, onUpdate, onError) {
  if (!userId) {
    onUpdate([])
    return () => {}
  }

  console.log('[ISSUE READ]', {
    uid: userId,
    queryPath: 'issues',
    queryConstraints: `where("userId", "==", "${userId}")`,
    userRole: 'citizen'
  })

  const issuesMap = new Map()
  let unsubDirect = () => {}
  let unsubReferences = () => {}
  const clusterUnsubscribers = new Map()

  function emitMerged() {
    const all = Array.from(issuesMap.values())
    const sorted = sortIssuesByPriority(all)
    onUpdate(sorted)
  }

  // 1. Direct subscription to issues created by this user
  const directQuery = query(collection(db, 'issues'), where('userId', '==', userId))
  unsubDirect = onSnapshot(
    directQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          issuesMap.delete(change.doc.id)
        } else {
          const data = change.doc.data()
          issuesMap.set(change.doc.id, {
            id: change.doc.id,
            issueClusterId: data.issueClusterId || data.groupId || change.doc.id,
            ...data
          })
        }
      })
      emitMerged()
    },
    (error) => {
      console.error('Error fetching user direct issues:', error)
      if (onError) onError(error)
    }
  )

  // 2. Subscription to userIssueReferences (for issues where citizen joined an existing cluster)
  const userRefsCol = collection(db, 'userIssueReferences', userId, 'issues')
  unsubReferences = onSnapshot(
    userRefsCol,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const refData = change.doc.data()
        const clusterId = refData.clusterId || change.doc.id

        if (change.type === 'removed') {
          if (!issuesMap.has(clusterId) || issuesMap.get(clusterId).userId !== userId) {
            issuesMap.delete(clusterId)
          }
          if (clusterUnsubscribers.has(clusterId)) {
            clusterUnsubscribers.get(clusterId)()
            clusterUnsubscribers.delete(clusterId)
          }
        } else {
          // If not already tracked as creator, listen to the live cluster document for status updates
          if (!clusterUnsubscribers.has(clusterId)) {
            const clusterDocRef = doc(db, 'issues', clusterId)
            const unsubCluster = onSnapshot(
              clusterDocRef,
              (clusterSnap) => {
                if (clusterSnap.exists()) {
                  const cData = clusterSnap.data()
                  issuesMap.set(clusterId, {
                    id: clusterId,
                    issueClusterId: cData.issueClusterId || cData.groupId || clusterId,
                    ...cData
                  })
                } else {
                  issuesMap.set(clusterId, {
                    id: clusterId,
                    issueClusterId: clusterId,
                    ...refData
                  })
                }
                emitMerged()
              },
              (err) => {
                console.warn('[CLUSTER REFERENCE SNAP ERROR]', err)
                if (!issuesMap.has(clusterId)) {
                  issuesMap.set(clusterId, {
                    id: clusterId,
                    issueClusterId: clusterId,
                    ...refData
                  })
                  emitMerged()
                }
              }
            )
            clusterUnsubscribers.set(clusterId, unsubCluster)
          }
        }
      })
      emitMerged()
    },
    (error) => {
      console.warn('[USER REFERENCES ERROR]', error)
    }
  )

  return () => {
    unsubDirect()
    unsubReferences()
    clusterUnsubscribers.forEach((unsub) => unsub())
    clusterUnsubscribers.clear()
  }
}

/**
 * Compute statistics for citizen issues.
 */
export function calculateIssueStats(issues = []) {
  const total = issues.length
  const resolved = issues.filter((i) => (i.status || '').toLowerCase() === 'resolved').length
  const inProgress = issues.filter((i) => (i.status || '').toLowerCase() === 'in progress').length
  const pending = issues.filter((i) => (i.status || 'Pending').toLowerCase() === 'pending').length

  return { total, resolved, inProgress, pending }
}

/**
 * Subscribe to issues scoped by Geographic Hierarchy:
 * - Super Admin: all
 * - State Admin: stateId
 * - District Admin: stateId + districtId
 * - Issue Resolution Employee: stateId + districtId + talukaId
 */
export function subscribeScopedIssues({ role, stateId, districtId, talukaId }, onUpdate, onError) {
  const issuesCollection = collection(db, 'issues')

  const unsubscribe = onSnapshot(
    issuesCollection,
    (snapshot) => {
      let issues = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          issueClusterId: data.issueClusterId || data.groupId || docSnap.id,
          groupId: data.groupId || docSnap.id,
          reportCount: typeof data.reportCount === 'number' ? data.reportCount : 1,
          ...data
        }
      })

      // Geographic scoping
      if (role === 'state_admin') {
        issues = issues.filter((i) => !stateId || i.stateId === stateId || i.state === stateId)
      } else if (role === 'district_admin') {
        issues = issues.filter(
          (i) => (!stateId || i.stateId === stateId || i.state === stateId) &&
                 (!districtId || i.districtId === districtId || i.district === districtId)
        )
      } else if (role === 'issue_resolution_employee') {
        issues = issues.filter(
          (i) => (!stateId || i.stateId === stateId || i.state === stateId) &&
                 (!districtId || i.districtId === districtId || i.district === districtId) &&
                 (!talukaId || i.talukaId === talukaId || i.taluka === talukaId)
        )
      }

      const sortedIssues = sortIssuesByPriority(issues)
      onUpdate(sortedIssues)
    },
    (error) => {
      console.error('Error fetching scoped issues:', error)
      if (onError) onError(error)
    }
  )

  return unsubscribe
}

/**
 * Legacy wrapper: Subscribe to all issues.
 */
export function subscribeAllIssues(onUpdate, onError) {
  return subscribeScopedIssues({ role: 'super_admin' }, onUpdate, onError)
}

/**
 * Update an issue cluster's canonical status in Firestore.
 * Propagates the status to all associated reports and citizens.
 */
export async function updateIssueStatus(issueId, newStatus, officialUid = '', resolutionNotes = '') {
  if (!issueId) throw new Error('Issue ID is required')
  const issueRef = doc(db, 'issues', issueId)

  const effectiveUid = officialUid || auth.currentUser?.uid || ''

  const updateData = {
    status: newStatus,
    updatedAt: serverTimestamp()
  }

  if (resolutionNotes) {
    updateData.resolutionNotes = resolutionNotes
  }

  if (newStatus === 'Resolved') {
    updateData.resolvedAt = serverTimestamp()
    if (effectiveUid) {
      updateData.resolvedBy = effectiveUid
    }
  } else if (newStatus === 'In Progress' || newStatus === 'Pending') {
    updateData.resolvedAt = null
    updateData.resolvedBy = null
  }

  await updateDoc(issueRef, updateData)
}

/**
 * Compute official statistics.
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
