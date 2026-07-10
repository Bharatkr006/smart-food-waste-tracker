/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { requestNotificationPermission, sendNotification } from '../utils/notifications.jsx';

const HostelDataContext = createContext();

export const useHostelData = () => useContext(HostelDataContext);

export const HostelDataProvider = ({ children }) => {
  const { currentUser, userData } = useAuth();
  const [listings, setListings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const previousListingsRef = useRef(new Map());

  useEffect(() => {
    if (!currentUser) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }

    // Request permission once component mounts
    requestNotificationPermission();

    let unsubscribeListings = null;
    let unsubscribeLogs = null;

    // Subscribe to Active Listings
    const qListings = query(
      collection(db, 'listings'),
      where('hostelId', '==', currentUser.uid)
    );
    unsubscribeListings = onSnapshot(qListings, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const prevMap = previousListingsRef.current;
      
      // Notify on state transitions
      if (prevMap.size > 0) {
        fetched.forEach(listing => {
          const prevListing = prevMap.get(listing.id);
          if (prevListing) {
            if (prevListing.status === 'Available' && listing.status === 'Accepted') {
              sendNotification(
                "Order Accepted! 🎉",
                `${listing.ngoName || 'An NGO'} has accepted your pickup for ${listing.title}.`
              );
            }
            if (prevListing.status === 'Accepted' && listing.status === 'Picked Up') {
              sendNotification(
                "Pickup Completed! ✅",
                `Your donation of ${listing.title} has been successfully picked up.`
              );
            }
          }
        });
      }

      // Update ref map
      const newMap = new Map();
      fetched.forEach(l => newMap.set(l.id, l));
      previousListingsRef.current = newMap;

      fetched.sort((a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
      setListings([...fetched]);
    });

    // Subscribe to Food Logs
    const qLogs = query(
      collection(db, 'foodLogs'),
      where('hostelId', '==', currentUser.uid)
    );
    unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      const now = Date.now();
      const fetchedLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = fetchedLogs
        .sort((a, b) => (b.createdAt?.toMillis?.() || now) - (a.createdAt?.toMillis?.() || now));
      
      setAllLogs([...sorted]);
      // Last 15 for charts (reversed for chronological order)
      setLogs([...sorted.slice(0, 15)].reverse());
      setLoading(false);
    }, (err) => {
      console.error("FoodLogs fetch error:", err);
      setLoading(false);
    });

    return () => {
      if (unsubscribeListings) unsubscribeListings();
      if (unsubscribeLogs) unsubscribeLogs();
    };
  }, [currentUser]);

  // KPI Calculations
  const calculateKPIs = useCallback(() => {
    const source = logs.length > 0 ? logs : [];
    if (source.length === 0) return { prepared: 0, consumed: 0, waste: 0, wastePct: 0 };
    const totalPrepared = source.reduce((acc, curr) => acc + (Number(curr.prepared) || 0), 0);
    const totalConsumed = source.reduce((acc, curr) => acc + (Number(curr.consumed) || 0), 0);
    const totalWaste = Math.max(0, totalPrepared - totalConsumed);
    const wastePct = totalPrepared > 0 ? ((totalWaste / totalPrepared) * 100).toFixed(1) : 0;
    return { prepared: totalPrepared, consumed: totalConsumed, waste: totalWaste, wastePct };
  }, [logs]);

  const kpis = calculateKPIs();

  // Add a new food log
  const addFoodLog = useCallback(async ({ foodItem, mealType, prepared, consumed }) => {
    if (!currentUser) throw new Error('Not authenticated');

    const surplusVal = Math.max(0, Number(prepared) - Number(consumed));
    const priority = surplusVal >= 20 ? 'High' : surplusVal >= 10 ? 'Medium' : 'Low';
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const fullTitle = `${mealType} - ${foodItem}`;

    // 1. Save to foodLogs (Always)
    const logDocRef = await addDoc(collection(db, 'foodLogs'), {
      hostelId: currentUser.uid,
      hostelName: userData?.name || 'My Hostel',
      title: fullTitle,
      prepared: Number(prepared),
      consumed: Number(consumed),
      surplus: surplusVal,
      status: surplusVal > 0 ? 'pending' : 'zero-waste',
      createdAt: serverTimestamp()
    });

    // 2. Auto-list for NGO if surplus
    if (surplusVal > 0) {
      await addDoc(collection(db, 'listings'), {
        hostelId: currentUser.uid,
        hostelName: userData?.name || 'My Hostel',
        title: fullTitle,
        quantity: `${surplusVal}`,
        location: userData?.location || { lat: 28.6139, lng: 77.2090 },
        locationName: userData?.address || 'Main Campus',
        status: 'Available',
        priority,
        expiryTime: expiryTime.toISOString(),
        createdAt: serverTimestamp(),
        logId: logDocRef.id
      });
    }

    return { surplus: surplusVal };
  }, [currentUser, userData]);

  // Update log status (store internally or list for NGO)
  const updateLogStatus = useCallback(async (logId, newStatus) => {
    const logRef = doc(db, 'foodLogs', logId);
    await updateDoc(logRef, { status: newStatus });
  }, []);

  // Create listing from a log
  const createListingFromLog = useCallback(async (log) => {
    if (!currentUser) throw new Error('Not authenticated');

    const surplusVal = log.surplus || 0;
    if (surplusVal <= 0) return;

    const priority = surplusVal >= 20 ? 'High' : surplusVal >= 10 ? 'Medium' : 'Low';
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    await addDoc(collection(db, 'listings'), {
      hostelId: currentUser.uid,
      hostelName: userData?.name || 'My Hostel',
      title: log.title,
      quantity: `${surplusVal}`,
      location: userData?.location || { lat: 28.6139, lng: 77.2090 },
      locationName: userData?.address || 'Main Campus',
      status: 'Available',
      priority,
      expiryTime: expiryTime.toISOString(),
      createdAt: serverTimestamp(),
      logId: log.id
    });

    // Update log status
    const logRef = doc(db, 'foodLogs', log.id);
    await updateDoc(logRef, { status: 'listed-for-ngo' });
  }, [currentUser, userData]);

  const value = {
    listings,
    logs,
    allLogs,
    loading,
    kpis,
    addFoodLog,
    updateLogStatus,
    createListingFromLog
  };

  return (
    <HostelDataContext.Provider value={value}>
      {children}
    </HostelDataContext.Provider>
  );
};
