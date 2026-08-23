import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config.js'
import {
  registerUser,
  loginUser,
  loginWithGoogle,
  logoutUser,
  getUserProfile
} from '../firebase/auth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true)
      if (user) {
        try {
          const profile = await getUserProfile(user.uid)
          setUserProfile(profile)
          setCurrentUser(user)
        } catch (error) {
          console.error('Failed to load user profile:', error)
          setUserProfile(null)
          setCurrentUser(user)
        }
      } else {
        setCurrentUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const register = async (name, email, password, country, state, localArea) => {
    setLoading(true)
    try {
      const user = await registerUser(name, email, password, country, state, localArea)
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
      return user
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await logoutUser()
    setCurrentUser(null)
    setUserProfile(null)
  }

  const value = {
    currentUser,
    userProfile,
    loading,
    register,
    login,
    googleLogin,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
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
