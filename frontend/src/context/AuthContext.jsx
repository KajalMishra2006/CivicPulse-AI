import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config.js'
import {
  registerUser,
  loginUser,
  loginWithGoogle,
  logoutUser,
  getUserProfile,
  updateUserLanguage
} from '../firebase/auth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Language preference state
  const [preferredLanguage, setPreferredLanguage] = useState(() => {
    return localStorage.getItem('civicpulse_language') || 'English'
  })

  const setLanguage = async (newLanguage) => {
    if (!newLanguage) return
    setPreferredLanguage(newLanguage)
    localStorage.setItem('civicpulse_language', newLanguage)

    if (currentUser?.uid) {
      try {
        await updateUserLanguage(currentUser.uid, newLanguage)
        setUserProfile((prev) => (prev ? { ...prev, preferredLanguage: newLanguage } : null))
      } catch (err) {
        console.error('Failed to sync language to Firestore profile:', err)
      }
    }
  }

  const saveUserLanguage = async (lang) => {
    await setLanguage(lang)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true)
      try {
        if (user) {
          console.log('[AUTH] onAuthStateChanged user detected:', user.uid)
          const profile = await getUserProfile(user.uid)
          setUserProfile(profile)
          setCurrentUser(user)

          if (profile?.preferredLanguage) {
            setPreferredLanguage(profile.preferredLanguage)
            localStorage.setItem('civicpulse_language', profile.preferredLanguage)
          }
          console.log('[AUTH] Authentication flow complete')
        } else {
          setCurrentUser(null)
          setUserProfile(null)
        }
      } catch (error) {
        console.error('[AUTH ERROR]', {
          code: error?.code,
          message: error?.message,
          operation: 'onAuthStateChanged (getUserProfile)',
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || ''
        })
        setUserProfile(null)
        setCurrentUser(user || null)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  // Supports both object parameter and legacy positional parameters
  const register = async (
    nameOrOptions,
    email,
    password,
    country,
    state,
    localArea,
    district = '',
    idType = 'Citizen Government ID',
    idNumber = '',
    idDocumentUrl = null
  ) => {
    setLoading(true)
    try {
      let payload
      if (typeof nameOrOptions === 'object' && nameOrOptions !== null) {
        payload = nameOrOptions
      } else {
        payload = {
          name: nameOrOptions,
          email,
          password,
          country,
          state,
          district,
          localArea,
          idType,
          idNumber,
          idDocumentUrl
        }
      }

      const user = await registerUser(payload)
      const profile = await getUserProfile(user.uid)
      setUserProfile(profile)
      setCurrentUser(user)
      return user
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    setLoading(true)
    try {
      const user = await loginUser(email, password)
      const profile = await getUserProfile(user.uid)
      setUserProfile(profile)
      setCurrentUser(user)
      if (profile?.preferredLanguage) {
        setPreferredLanguage(profile.preferredLanguage)
        localStorage.setItem('civicpulse_language', profile.preferredLanguage)
      }
      return user
    } finally {
      setLoading(false)
    }
  }

  const googleLogin = async () => {
    setLoading(true)
    try {
      const user = await loginWithGoogle()
      const profile = await getUserProfile(user.uid)
      setUserProfile(profile)
      setCurrentUser(user)
      if (profile?.preferredLanguage) {
        setPreferredLanguage(profile.preferredLanguage)
        localStorage.setItem('civicpulse_language', profile.preferredLanguage)
      }
      return user
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await logoutUser()
      setCurrentUser(null)
      setUserProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const value = {
    currentUser,
    userProfile,
    preferredLanguage,
    setLanguage,
    saveUserLanguage,
    loading,
    register,
    login,
    googleLogin,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
