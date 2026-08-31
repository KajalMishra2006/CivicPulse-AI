import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  writeBatch,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { auth, db } from './config.js'
import { resolveLocationMetadata } from '../utils/locations.js'

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth'

/**
 * Compresses and stores an official government employee ID document (JPEG, PNG, WebP, PDF)
 * Max size: 5MB.
 */
export async function uploadOfficialIdDocument(file) {
  if (!file) return null

  const MAX_SIZE_BYTES = 5 * 1024 * 1024
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`File too large: ID Document size exceeds the 5 MB limit.`)
  }

  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    throw new Error('Invalid file format: Only image files (JPG, PNG, WebP) or PDF documents are supported.')
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
          const MAX_WIDTH = 1200
          const MAX_HEIGHT = 1200
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

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8)
          resolve(compressedDataUrl)
        } catch (canvasErr) {
          reject(new Error('Failed to process image: ' + canvasErr.message))
        }
      }
      img.onerror = () => reject(new Error('Failed to read ID document image.'))
      img.src = readerEvent.target.result
    }
    reader.onerror = () => reject(new Error('Failed to upload ID document.'))
    reader.readAsDataURL(file)
  })
}

function logAuthError(op, error) {
  console.error('[AUTH ERROR]', {
    code: error?.code,
    message: error?.message,
    operation: op,
    authDomain: auth?.config?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: auth?.config?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || ''
  })
}

/**
 * Register a new Government Employee Applicant or submit verification for existing user.
 * Creates an applicant account (pending verification), uploads ID document, and files a verification request.
 */
export async function registerOfficialApplicant({
  name,
  email,
  password,
  mobileNumber = '',
  organization,
  department,
  designation = '',
  employeeId,
  state = 'Maharashtra',
  district = 'Pune',
  taluka = 'Haveli',
  employeeType = 'ISSUE_RESOLUTION', // 'CITIZEN_ACCESS' | 'ISSUE_RESOLUTION' | 'DISTRICT_ADMIN' | 'STATE_ADMIN'
  requestedRole = '',
  reason = '',
  idFile = null
}) {
  if (
    !name || !name.trim() ||
    !email || !email.trim() ||
    !organization || !organization.trim() ||
    !department || !department.trim() ||
    !employeeId || !employeeId.trim()
  ) {
    throw new Error('Please fill in all required official fields.')
  }

  let user = auth.currentUser
  console.log('[VERIFY] submitVerificationRequest / registerOfficialApplicant called')
  if (user) {
    console.log('[VERIFY] Authenticated UID:', user.uid)
  }

  // 1. Establish Firebase Auth session for the applicant if not already signed in
  if (!user) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters to create your official applicant account.')
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password)
      user = userCredential.user
      console.log('[VERIFY] Authenticated UID created:', user.uid)
      if (name) {
        try {
          await updateProfile(user, { displayName: name.trim() })
        } catch (upErr) {
          logAuthError('updateProfile (official applicant)', upErr)
        }
      }
    } catch (authErr) {
      logAuthError('createUserWithEmailAndPassword (official applicant)', authErr)
      if (authErr.code === 'auth/email-already-in-use') {
        // Try logging in with the existing account
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password)
          user = userCredential.user
          console.log('[VERIFY] Authenticated UID existing session:', user.uid)
        } catch (loginErr) {
          logAuthError('signInWithEmailAndPassword (official applicant fallback)', loginErr)
          throw new Error('This email is already registered. Please enter your existing password or sign in first.', { cause: loginErr })
        }
      } else {
        throw authErr
      }
    }
  }

  // 2. Upload official ID document securely
  let idDocumentUrl = null
  if (idFile) {
    console.log('[VERIFY] Starting ID upload')
    idDocumentUrl = await uploadOfficialIdDocument(idFile)
    console.log('[VERIFY] ID upload successful:', idDocumentUrl ? 'Uploaded image data URL' : null)
  }

  const geo = resolveLocationMetadata({ state, district, taluka })

  const isStateAdmin =
    employeeType === 'state_admin' ||
    employeeType === 'STATE_ADMIN' ||
    requestedRole === 'state_admin' ||
    requestedRole === 'STATE_ADMIN'

  const isDistrictAdmin =
    employeeType === 'district_admin' ||
    employeeType === 'DISTRICT_ADMIN' ||
    requestedRole === 'district_admin' ||
    requestedRole === 'DISTRICT_ADMIN'

  const isCitizenAccess =
    employeeType === 'citizen_access' ||
    employeeType === 'citizen_access_employee' ||
    employeeType === 'CITIZEN_ACCESS' ||
    employeeType === 'CITIZEN_ACCESS_EMPLOYEE' ||
    requestedRole === 'citizen_access_employee' ||
    requestedRole === 'CITIZEN_ACCESS'

  const canonicalRequestedRole = isStateAdmin
    ? 'state_admin'
    : isDistrictAdmin
    ? 'district_admin'
    : isCitizenAccess
    ? 'citizen_access_employee'
    : 'issue_resolution_employee'

  const canonicalEmployeeType = isStateAdmin
    ? 'state_admin'
    : isDistrictAdmin
    ? 'district_admin'
    : isCitizenAccess
    ? 'citizen_access_employee'
    : 'issue_resolution_employee'

  // 3. Create verification request in verificationRequests collection FIRST
  const selectedStateId = geo.stateId || (state || '').toLowerCase().replace(/\s+/g, '-')
  const selectedStateName = geo.stateName || state || 'Maharashtra'

  const requestData = {
    userId: user.uid,
    applicantUid: user.uid,
    name: name.trim(),
    applicantName: name.trim(),
    email: email.trim().toLowerCase(),
    applicantEmail: email.trim().toLowerCase(),
    mobileNumber: mobileNumber || '',
    organization: organization.trim(),
    department: department.trim(),
    designation: (designation || '').trim(),
    employeeId: employeeId.trim(),
    employeeType: canonicalEmployeeType,
    requestedRole: canonicalRequestedRole,
    stateId: selectedStateId,
    stateName: selectedStateName,
    state: selectedStateName,
    districtId: isStateAdmin ? null : geo.districtId,
    districtName: isStateAdmin ? null : geo.districtName,
    district: isStateAdmin ? null : geo.districtName,
    talukaId: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaId,
    talukaName: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
    taluka: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
    reason: (reason || '').trim(),
    idDocumentUrl: idDocumentUrl || null,
    governmentIdDocumentUrl: idDocumentUrl || null,
    idDocumentUploadedAt: idDocumentUrl ? serverTimestamp() : null,
    status: 'pending',
    createdAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    reviewedAt: null,
    reviewedBy: null
  }

  console.log('[FIRESTORE] createVerificationRequest START')
  console.log('[FIRESTORE] auth UID:', user.uid)
  console.log('[FIRESTORE] requestData:', requestData)

  let docRef
  try {
    docRef = await addDoc(collection(db, 'verificationRequests'), requestData)
    console.log('[FIRESTORE] addDoc SUCCESS:', docRef.id)
  } catch (error) {
    console.error('[FIRESTORE] addDoc FAILED')
    console.error('code:', error?.code)
    console.error('message:', error?.message)
    console.error('error:', error)
    logAuthError('addDoc (verificationRequests)', error)
    throw error
  }

  // 4. Optional: sync applicant profile in users/{uid} (role: 'applicant', verified: false) AFTER request doc is created
  try {
    const userDocRef = doc(db, 'users', user.uid)
    await setDoc(userDocRef, {
      uid: user.uid,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobileNumber: mobileNumber || '',
      role: 'applicant',
      accountStatus: 'pending',
      verified: false,
      employeeType: canonicalEmployeeType,
      requestedRole: canonicalRequestedRole,
      employeeId: employeeId.trim(),
      organization: organization.trim(),
      department: department.trim(),
      designation: (designation || '').trim(),
      stateId: geo.stateId,
      stateName: geo.stateName,
      state: geo.stateName,
      districtId: isStateAdmin ? null : geo.districtId,
      districtName: isStateAdmin ? null : geo.districtName,
      district: isStateAdmin ? null : geo.districtName,
      talukaId: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaId,
      talukaName: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
      taluka: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
      governmentIdDocumentUrl: idDocumentUrl || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true })
  } catch (err) {
    console.warn('[USERS SYNC] Optional user profile update skipped:', err?.message)
  }

  return { id: docRef.id, user, ...requestData }
}

/**
 * Submit a new Government Employee / Administrator Registration Request (for existing session).
 */
export async function submitVerificationRequest({
  userId = '',
  name,
  email,
  mobileNumber = '',
  organization,
  department,
  designation = '',
  employeeId,
  state = 'Maharashtra',
  district = 'Pune',
  taluka = 'Haveli',
  employeeType = 'ISSUE_RESOLUTION',
  requestedRole = '',
  reason = '',
  idDocumentUrl = null
}) {
  if (
    !name || !name.trim() ||
    !email || !email.trim() ||
    !organization || !organization.trim() ||
    !department || !department.trim() ||
    !employeeId || !employeeId.trim()
  ) {
    throw new Error('Please fill in all required verification fields.')
  }

  const effectiveUserId = userId || auth.currentUser?.uid || ''

  if (!effectiveUserId || !auth.currentUser) {
    throw new Error('Authentication is required to submit a verification request. Please sign up or sign in.')
  }

  console.log('[VERIFY] submitVerificationRequest called')
  console.log('[VERIFY] Authenticated UID:', effectiveUserId)

  const isStateAdmin =
    employeeType === 'state_admin' ||
    employeeType === 'STATE_ADMIN' ||
    requestedRole === 'state_admin' ||
    requestedRole === 'STATE_ADMIN'

  const isDistrictAdmin =
    employeeType === 'district_admin' ||
    employeeType === 'DISTRICT_ADMIN' ||
    requestedRole === 'district_admin' ||
    requestedRole === 'DISTRICT_ADMIN'

  const isCitizenAccess =
    employeeType === 'citizen_access' ||
    employeeType === 'citizen_access_employee' ||
    employeeType === 'CITIZEN_ACCESS' ||
    employeeType === 'CITIZEN_ACCESS_EMPLOYEE' ||
    requestedRole === 'citizen_access_employee' ||
    requestedRole === 'CITIZEN_ACCESS'

  const canonicalRequestedRole = isStateAdmin
    ? 'state_admin'
    : isDistrictAdmin
    ? 'district_admin'
    : isCitizenAccess
    ? 'citizen_access_employee'
    : 'issue_resolution_employee'

  const canonicalEmployeeType = isStateAdmin
    ? 'state_admin'
    : isDistrictAdmin
    ? 'district_admin'
    : isCitizenAccess
    ? 'citizen_access_employee'
    : 'issue_resolution_employee'

  const geo = resolveLocationMetadata({ state, district, taluka })
  const selectedStateId = geo.stateId || (state || '').toLowerCase().replace(/\s+/g, '-')
  const selectedStateName = geo.stateName || state || 'Maharashtra'

  const requestData = {
    userId: effectiveUserId,
    applicantUid: effectiveUserId,
    name: name.trim(),
    applicantName: name.trim(),
    email: email.trim().toLowerCase(),
    applicantEmail: email.trim().toLowerCase(),
    mobileNumber: mobileNumber || '',
    organization: organization.trim(),
    department: department.trim(),
    designation: (designation || '').trim(),
    employeeId: employeeId.trim(),
    employeeType: canonicalEmployeeType,
    requestedRole: canonicalRequestedRole,
    stateId: selectedStateId,
    stateName: selectedStateName,
    state: selectedStateName,
    districtId: isStateAdmin ? null : geo.districtId,
    districtName: isStateAdmin ? null : geo.districtName,
    district: isStateAdmin ? null : geo.districtName,
    talukaId: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaId,
    talukaName: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
    taluka: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
    reason: (reason || '').trim(),
    idDocumentUrl: idDocumentUrl || null,
    idDocumentUploadedAt: idDocumentUrl ? serverTimestamp() : null,
    status: 'pending',
    createdAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    reviewedAt: null,
    reviewedBy: null
  }

  console.log('[VERIFY] Starting Firestore request')
  console.log('[VERIFY] Creating verificationRequests document', {
    requestedRole: canonicalRequestedRole,
    employeeType: canonicalEmployeeType,
    stateId: selectedStateId,
    stateName: selectedStateName,
    userId: effectiveUserId
  })

  let docRef
  try {
    docRef = await addDoc(collection(db, 'verificationRequests'), requestData)
    console.log('[VERIFY] Firestore request CREATED:', docRef.id)
  } catch (err) {
    console.error('[VERIFY FIRESTORE ERROR]', {
      code: err?.code,
      message: err?.message
    })
    logAuthError('addDoc (verificationRequests)', err)
    throw err
  }

  return { id: docRef.id, ...requestData }
}

/**
 * Fetch the latest verification request for a specific user.
 */
export async function getUserVerificationRequest(userId, email = '') {
  if (!userId && !email) return null

  try {
    if (userId) {
      const q = query(
        collection(db, 'verificationRequests'),
        where('userId', '==', userId)
      )
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        requests.sort((a, b) => ((b.submittedAt?.seconds || b.createdAt?.seconds || 0) - (a.submittedAt?.seconds || a.createdAt?.seconds || 0)))
        return requests[0]
      }
    }

    if (email) {
      const q = query(
        collection(db, 'verificationRequests'),
        where('email', '==', email.trim().toLowerCase())
      )
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        requests.sort((a, b) => ((b.submittedAt?.seconds || b.createdAt?.seconds || 0) - (a.submittedAt?.seconds || a.createdAt?.seconds || 0)))
        return requests[0]
      }
    }
  } catch (err) {
    console.error('Error fetching verification request:', err)
  }

  return null
}

/**
 * Subscribe to verification requests scoped by Administrator tier:
 * - Super Admin: sees all
 * - State Admin: sees only their state requests (e.g. District Admins)
 * - District Admin: sees only their district requests (e.g. Taluka Employees)
 */
export function subscribeScopedVerificationRequests({ role, stateId, districtId }, onUpdate, onError) {
  const requestsCollection = collection(db, 'verificationRequests')

  console.log('[STATE ADMIN REQUEST QUERY]', {
    requestedRole: 'STATE_ADMIN',
    status: 'pending'
  })

  const unsubscribe = onSnapshot(
    requestsCollection,
    (snapshot) => {
      console.log('[STATE ADMIN REQUEST COUNT]', snapshot.size)
      let requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

      const normalizedRole = (role || '').toLowerCase()

      if (normalizedRole === 'state_admin') {
        requests = requests.filter((r) => {
          const reqStateId = (r.stateId || r.state || r.stateName || '').toLowerCase()
          const targetStateId = (stateId || '').toLowerCase()
          return reqStateId === targetStateId || !targetStateId
        })
      } else if (normalizedRole === 'district_admin') {
        requests = requests.filter((r) => {
          const reqStateId = (r.stateId || r.state || r.stateName || '').toLowerCase()
          const targetStateId = (stateId || '').toLowerCase()
          const reqDistId = (r.districtId || r.district || r.districtName || '').toLowerCase()
          const targetDistId = (districtId || '').toLowerCase()
          const stateMatch = reqStateId === targetStateId || !targetStateId
          const distMatch = reqDistId === targetDistId || !targetDistId
          return stateMatch && distMatch
        })
      }

      requests.sort((a, b) => {
        const timeA = a.submittedAt?.seconds || a.createdAt?.seconds || 0
        const timeB = b.submittedAt?.seconds || b.createdAt?.seconds || 0
        return timeB - timeA
      })

      onUpdate(requests)
    },
    (error) => {
      console.error('[SUPER ADMIN] Firestore error loading verification requests:', {
        code: error?.code,
        message: error?.message
      })
      if (onError) onError(error)
    }
  )

  return unsubscribe
}

/**
 * Dedicated subscription for Super Admin to monitor State Admin applications nationwide.
 */
export function subscribeStateAdminRequests(onUpdate, onError) {
  const requestsCollection = collection(db, 'verificationRequests')
  console.log('[STATE ADMIN REQUEST QUERY]', {
    requestedRole: 'STATE_ADMIN',
    status: 'pending'
  })

  const unsubscribe = onSnapshot(
    requestsCollection,
    (snapshot) => {
      console.log('[STATE ADMIN REQUEST COUNT]', snapshot.size)
      const allReqs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      const stateAdminReqs = allReqs.filter((r) => {
        const role = (r.requestedRole || '').toUpperCase().replace(/[\s-]/g, '_')
        const type = (r.employeeType || '').toUpperCase().replace(/[\s-]/g, '_')
        return role === 'STATE_ADMIN' || type === 'STATE_ADMIN'
      })

      stateAdminReqs.sort((a, b) => {
        const timeA = a.submittedAt?.seconds || a.createdAt?.seconds || 0
        const timeB = b.submittedAt?.seconds || b.createdAt?.seconds || 0
        return timeB - timeA
      })

      const pendingCount = stateAdminReqs.filter((r) => (r.status || 'pending').toLowerCase() === 'pending').length
      console.log('[SUPER ADMIN] State Admin requests loaded:', stateAdminReqs.length, 'Pending:', pendingCount)

      onUpdate(stateAdminReqs)
    },
    (error) => {
      console.error('[SUPER ADMIN] Firestore error:', {
        code: error?.code,
        message: error?.message
      })
      if (onError) onError(error)
    }
  )

  return unsubscribe
}

/**
 * Subscribe to citizens scoped by Taluka for Citizen Access Employees.
 */
export function subscribeTalukaCitizens({ stateId, districtId, talukaId }, onUpdate, onError) {
  const usersCollection = collection(db, 'users')

  const unsubscribe = onSnapshot(
    usersCollection,
    (snapshot) => {
      const allCitizens = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((user) => user.role === 'citizen' || !user.role)

      const filtered = allCitizens.filter((cit) => {
        if (!stateId && !districtId && !talukaId) return true
        if (stateId && cit.stateId && cit.stateId !== stateId && cit.state !== stateId) return false
        if (districtId && cit.districtId && cit.districtId !== districtId && cit.district !== districtId) return false
        if (talukaId && cit.talukaId && cit.talukaId !== talukaId && cit.taluka !== talukaId) return false
        return true
      })

      filtered.sort((a, b) => {
        const timeA = a.identitySubmittedAt?.seconds || a.createdAt?.seconds || 0
        const timeB = b.identitySubmittedAt?.seconds || b.createdAt?.seconds || 0
        return timeB - timeA
      })

      onUpdate(filtered)
    },
    (error) => {
      console.error('Error fetching taluka citizens:', error)
      if (onError) onError(error)
    }
  )

  return unsubscribe
}

/**
 * Super Admin, State Admin, or District Admin approves an employee/admin request.
 */
export async function approveEmployeeHierarchy({
  requestId,
  userId,
  assignedRole,
  state,
  district,
  taluka,
  adminUid
}) {
  if (!requestId || !userId) {
    throw new Error('Request ID and User ID are required.')
  }

  const reviewerUid = adminUid || auth.currentUser?.uid
  if (!reviewerUid) {
    throw new Error('Admin authentication is required for approval.')
  }

  const geo = resolveLocationMetadata({ state, district, taluka })

  const rawRole = (assignedRole || '').toUpperCase().replace(/[\s-]/g, '_')
  const isStateAdmin = rawRole === 'STATE_ADMIN' || assignedRole === 'state_admin'
  const isDistrictAdmin = rawRole === 'DISTRICT_ADMIN' || assignedRole === 'district_admin'
  const isCitizenAccess = rawRole === 'CITIZEN_ACCESS' || rawRole === 'CITIZEN_ACCESS_EMPLOYEE' || assignedRole === 'citizen_access_employee'

  const canonicalUserRole = isStateAdmin
    ? 'state_admin'
    : isDistrictAdmin
    ? 'district_admin'
    : isCitizenAccess
    ? 'citizen_access_employee'
    : 'issue_resolution_employee'

  const canonicalAssignedRole = isStateAdmin
    ? 'STATE_ADMIN'
    : isDistrictAdmin
    ? 'DISTRICT_ADMIN'
    : isCitizenAccess
    ? 'CITIZEN_ACCESS'
    : 'ISSUE_RESOLUTION'

  try {
    const batch = writeBatch(db)

    // 1. Update verification request document
    const requestRef = doc(db, 'verificationRequests', requestId)
    batch.set(requestRef, {
      status: 'approved',
      assignedRole: canonicalAssignedRole,
      stateId: geo.stateId,
      stateName: geo.stateName,
      state: geo.stateName,
      districtId: isStateAdmin ? null : geo.districtId,
      districtName: isStateAdmin ? null : geo.districtName,
      district: isStateAdmin ? null : geo.districtName,
      talukaId: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaId,
      talukaName: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
      taluka: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
      reviewedAt: serverTimestamp(),
      reviewedBy: reviewerUid,
      approvedBy: reviewerUid,
      approvedAt: serverTimestamp()
    }, { merge: true })

    // 2. Update user profile document
    const userRef = doc(db, 'users', userId)
    batch.set(userRef, {
      role: canonicalUserRole,
      accountStatus: 'approved',
      verified: true,
      stateId: geo.stateId,
      stateName: geo.stateName,
      state: geo.stateName,
      districtId: isStateAdmin ? null : geo.districtId,
      districtName: isStateAdmin ? null : geo.districtName,
      district: isStateAdmin ? null : geo.districtName,
      talukaId: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaId,
      talukaName: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
      taluka: (isStateAdmin || isDistrictAdmin) ? null : geo.talukaName,
      approvedBy: reviewerUid,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true })

    await batch.commit()
    console.log('[SUPER ADMIN] Approved application successfully:', { requestId, userId, canonicalUserRole })
  } catch (err) {
    logAuthError('approveEmployeeHierarchy (batch.commit)', err)
    throw err
  }
}

/**
 * Reject a verification request with reason.
 */
export async function rejectVerificationRequest(requestId, adminUid, reason = '') {
  if (!requestId) throw new Error('Request ID is required')

  const reviewerUid = adminUid || auth.currentUser?.uid
  if (!reviewerUid) {
    throw new Error('Admin authentication is required.')
  }

  const requestRef = doc(db, 'verificationRequests', requestId)
  await updateDoc(requestRef, {
    status: 'rejected',
    rejectionReason: reason || 'Credentials could not be verified.',
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewerUid
  })
}

/**
 * Citizen Access Employee approves a citizen registration in their taluka.
 */
export async function approveCitizenIdentity(citizenUid, officerUid) {
  if (!citizenUid) throw new Error('Citizen UID is required')
  const userRef = doc(db, 'users', citizenUid)

  await updateDoc(userRef, {
    identityVerificationStatus: 'verified',
    accountStatus: 'active',
    verified: true,
    identityVerifiedAt: serverTimestamp(),
    identityReviewedBy: officerUid || auth.currentUser?.uid || ''
  })
}

/**
 * Citizen Access Employee rejects a citizen registration in their taluka.
 */
export async function rejectCitizenIdentity(citizenUid, officerUid, reason = '') {
  if (!citizenUid) throw new Error('Citizen UID is required')
  const userRef = doc(db, 'users', citizenUid)

  await updateDoc(userRef, {
    identityVerificationStatus: 'rejected',
    accountStatus: 'rejected',
    identityRejectionReason: reason || 'Citizen verification document could not be verified.',
    identityReviewedAt: serverTimestamp(),
    identityReviewedBy: officerUid || auth.currentUser?.uid || ''
  })
}
