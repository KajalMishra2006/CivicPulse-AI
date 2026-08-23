import {
  collection,
  doc,
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

/**
 * Submit a new Government Official Verification Request.
 */
export async function submitVerificationRequest({
  userId = '',
  name,
  email,
  organization,
  department,
  employeeId,
  reason
}) {
  if (!name || !name.trim() || !email || !email.trim() || !organization || !organization.trim() || !department || !department.trim() || !employeeId || !employeeId.trim()) {
    throw new Error('Please fill in all required verification fields.')
  }

  const effectiveUserId = userId || auth.currentUser?.uid || ''

  if (!effectiveUserId || !auth.currentUser) {
    throw new Error('Authentication is required to submit a verification request. Please sign in or provide your credentials.')
  }

  const requestData = {
    userId: effectiveUserId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    organization: organization.trim(),
    department: department.trim(),
    employeeId: employeeId.trim(),
    reason: (reason || '').trim(),
    status: 'pending',
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null
  }

  // Temporary diagnostic logging as requested
  console.log('[submitVerificationRequest] auth.currentUser?.uid:', auth.currentUser?.uid)
  console.log('[submitVerificationRequest] auth.currentUser?.email:', auth.currentUser?.email)
  console.log('[submitVerificationRequest] complete request data:', requestData)

  const docRef = await addDoc(collection(db, 'verificationRequests'), requestData)
  return { id: docRef.id, ...requestData }
}

/**
 * Fetch the latest verification request for a specific user ID or email.
 */
export async function getUserVerificationRequest(userId, email = '') {
  if (!userId && !email) return null

  try {
    // 1. Try querying by userId if present
    if (userId) {
      const q = query(
        collection(db, 'verificationRequests'),
        where('userId', '==', userId)
      )
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        requests.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0
          const tB = b.createdAt?.seconds || 0
          return tB - tA
        })
        return requests[0]
      }
    }

    // 2. Fallback to querying by email
    if (email) {
      const q = query(
        collection(db, 'verificationRequests'),
        where('email', '==', email.trim().toLowerCase())
      )
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        requests.sort((a, b) => {
          const tA = a.createdAt?.seconds || 0
          const tB = b.createdAt?.seconds || 0
          return tB - tA
        })
        return requests[0]
      }
    }
  } catch (err) {
    console.error('Error fetching verification request:', err)
  }

  return null
}

/**
 * Subscribe in real-time to ALL verification requests (for Admin Dashboard).
 */
export function subscribeVerificationRequests(onUpdate, onError) {
  const requestsCollection = collection(db, 'verificationRequests')

  const unsubscribe = onSnapshot(
    requestsCollection,
    (snapshot) => {
      const requests = snapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0
          return timeB - timeA
        })
      onUpdate(requests)
    },
    (error) => {
      console.error('Error fetching verification requests:', error)
      if (onError) onError(error)
    }
  )

  return unsubscribe
}

/**
 * Approve an official verification request atomically using writeBatch.
 * 1. Updates verificationRequests/{requestId} -> status: "approved", reviewedAt, reviewedBy
 * 2. Updates users/{userId} -> role: "official", verified: true, updatedAt
 */
export async function approveVerificationRequest(requestId, userId, adminUid) {
  if (!requestId) throw new Error('Request ID is required')
  if (!userId) throw new Error('User ID is required for verification approval')

  const currentAdminUid = adminUid || auth.currentUser?.uid
  if (!currentAdminUid) {
    throw new Error('Admin authentication is required')
  }

  const batch = writeBatch(db)

  // 1. Target verification request document
  const requestRef = doc(db, 'verificationRequests', requestId)
  batch.update(requestRef, {
    status: 'approved',
    reviewedAt: serverTimestamp(),
    reviewedBy: currentAdminUid
  })

  // 2. Target user profile document
  const userRef = doc(db, 'users', userId)
  batch.update(userRef, {
    role: 'official',
    verified: true,
    updatedAt: serverTimestamp()
  })

  // Atomic commit
  await batch.commit()
}

/**
 * Reject an official verification request.
 * Updates only verificationRequests/{requestId} -> status: "rejected", reviewedAt, reviewedBy
 */
export async function rejectVerificationRequest(requestId, adminUid) {
  if (!requestId) throw new Error('Request ID is required')

  const currentAdminUid = adminUid || auth.currentUser?.uid
  if (!currentAdminUid) {
    throw new Error('Admin authentication is required')
  }

  const requestRef = doc(db, 'verificationRequests', requestId)
  await updateDoc(requestRef, {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    reviewedBy: currentAdminUid
  })
}
