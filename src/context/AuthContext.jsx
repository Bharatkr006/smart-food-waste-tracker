/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication Context Provider
 * Manages Firebase authentication state, user profile synchronization,
 * and authorization status across the application.
 * 
 * @module context/AuthContext
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

/**
 * Custom hook to consume the current Authentication context.
 * Provides currentUser, userData profile, loading state, and profile updater.
 * 
 * @returns {{
 *   currentUser: import('firebase/auth').User | null,
 *   userData: Object | null,
 *   loading: boolean,
 *   updateUser: (newData: Object) => Promise<void>
 * }}
 */
export const useAuth = () => useContext(AuthContext);

/**
 * Root Authentication Provider component wrapping authenticated subtrees.
 * Listens for auth state transitions and maintains real-time sync with user firestore record.
 */
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    let unsubscribeDoc = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        // Subscribe to user data from Firestore in real-time
        const docRef = doc(db, 'users', user.uid);
        unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
          setLoading(false);
        }, (err) => {
          console.error("Error loading user profile:", err);
          setLoading(false);
        });
      } else {
        setCurrentUser(null);
        setUserData(null);
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  const updateUser = async (newData) => {
    if (currentUser) {
      setUserData(prev => ({ ...prev, ...newData }));
    }
  };

  const value = {
    currentUser,
    userData,
    loading,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
