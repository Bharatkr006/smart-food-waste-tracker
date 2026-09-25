/* eslint-disable react-refresh/only-export-components */
/**
 * Hostel Data Context Provider
 * Manages operational state including food surplus listings, waste logs,
 * targeted reduction actions, real-time Firestore listeners, and derived telemetry.
 * 
 * @module context/HostelDataContext
 */
import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { requestNotificationPermission, sendNotification } from '../utils/notifications.jsx';
import { computeCoreMetrics, computeRescueFunnel, computeBaselineComparison, detectCategoryFromTitle } from '../utils/analyticsEngine';
import { calculateImpactTelemetry, calculateImpactTimeSeries } from '../utils/impactCalculator';

const HostelDataContext = createContext();

/**
 * Custom hook to access operational hostel listings, waste logs, metrics, and dispatcher methods.
 */
export const useHostelData = () => useContext(HostelDataContext);

/**
 * Provides live synchronization with Firestore collections for the authenticated hostel organization.
 */
export const HostelDataProvider = ({ children }) => {
  const { currentUser, userData } = useAuth();
  const [listings, setListings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const previousListingsRef = useRef(new Map());

  useEffect(() => {
    if (!currentUser || !db) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }

    // Request notification permission once component mounts
    requestNotificationPermission();

    let unsubscribeListings = null;
    let unsubscribeLogs = null;
    let unsubscribeActions = null;

    try {
      // 1. Subscribe to Active Listings
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

        const newMap = new Map();
        fetched.forEach(l => newMap.set(l.id, l));
        previousListingsRef.current = newMap;

        fetched.sort((a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
        setListings([...fetched]);
      }, (err) => {
        console.warn("Listings snapshot warning:", err);
      });

      // 2. Subscribe to Food Logs
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
        setLogs([...sorted.slice(0, 30)].reverse());
        setLoading(false);
      }, (err) => {
        console.warn("FoodLogs snapshot warning:", err);
        setLoading(false);
      });

      // 3. Subscribe to Actions Collection
      const qActions = query(
        collection(db, 'actions'),
        where('hostelId', '==', currentUser.uid)
      );
      unsubscribeActions = onSnapshot(qActions, (snap) => {
        const fetchedActions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        fetchedActions.sort((a, b) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
        setActions([...fetchedActions]);
      }, (err) => {
        console.warn("Actions snapshot warning:", err);
      });

    } catch (e) {
      console.error("HostelDataProvider setup error:", e);
      setLoading(false);
    }

    return () => {
      if (unsubscribeListings) unsubscribeListings();
      if (unsubscribeLogs) unsubscribeLogs();
      if (unsubscribeActions) unsubscribeActions();
    };
  }, [currentUser]);

  // Evaluated Core KPIs
  const kpis = useMemo(() => {
    return computeCoreMetrics(allLogs, listings);
  }, [allLogs, listings]);

  // Evaluated Food Rescue Funnel
  const rescueFunnel = useMemo(() => {
    return computeRescueFunnel(allLogs, listings);
  }, [allLogs, listings]);

  // Evaluated Impact Telemetry
  const impactTelemetry = useMemo(() => {
    return calculateImpactTelemetry(listings, allLogs);
  }, [listings, allLogs]);

  // Evaluated Cumulative Impact Time Series
  const impactTimeSeries = useMemo(() => {
    return calculateImpactTimeSeries(listings);
  }, [listings]);

  // Evaluated 7-Day Baseline Delta
  const baseline7Days = useMemo(() => {
    return computeBaselineComparison(allLogs, 7);
  }, [allLogs]);

  // Add Enhanced Food Log
  const addFoodLog = useCallback(async ({ foodItem, mealType, category, prepared, consumed, wasteType = 'overproduction', unit = 'portions' }) => {
    if (!currentUser) throw new Error('Not authenticated');

    const surplusVal = Math.max(0, Number(prepared) - Number(consumed));
    const priority = surplusVal >= 20 ? 'High' : surplusVal >= 10 ? 'Medium' : 'Low';
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const fullTitle = `${mealType} - ${foodItem}`;
    const detectedCategory = category || detectCategoryFromTitle(foodItem);

    if (!db) {
      console.warn("Firestore not initialized");
      return { surplus: surplusVal };
    }

    // 1. Save to foodLogs
    const logDocRef = await addDoc(collection(db, 'foodLogs'), {
      hostelId: currentUser.uid,
      hostelName: userData?.name || 'My Hostel',
      title: fullTitle,
      foodItem,
      mealType,
      category: detectedCategory,
      prepared: Number(prepared),
      consumed: Number(consumed),
      surplus: surplusVal,
      wasteType,
      unit,
      status: surplusVal > 0 ? 'pending' : 'zero-waste',
      createdAt: serverTimestamp()
    });

    // 2. Auto-list for NGO if surplus
    if (surplusVal > 0) {
      await addDoc(collection(db, 'listings'), {
        hostelId: currentUser.uid,
        hostelName: userData?.name || 'My Hostel',
        title: fullTitle,
        category: detectedCategory,
        quantity: `${surplusVal}`,
        unit,
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

  // Update Log Status
  const updateLogStatus = useCallback(async (logId, newStatus) => {
    if (!db) return;
    const logRef = doc(db, 'foodLogs', logId);
    await updateDoc(logRef, { status: newStatus });
  }, []);

  // Create Listing from Log
  const createListingFromLog = useCallback(async (log) => {
    if (!currentUser || !db) throw new Error('Not authenticated');

    const surplusVal = log.surplus || 0;
    if (surplusVal <= 0) return;

    const priority = surplusVal >= 20 ? 'High' : surplusVal >= 10 ? 'Medium' : 'Low';
    const now = new Date();
    const expiryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const category = log.category || detectCategoryFromTitle(log.title || '');

    await addDoc(collection(db, 'listings'), {
      hostelId: currentUser.uid,
      hostelName: userData?.name || 'My Hostel',
      title: log.title,
      category,
      quantity: `${surplusVal}`,
      location: userData?.location || { lat: 28.6139, lng: 77.2090 },
      locationName: userData?.address || 'Main Campus',
      status: 'Available',
      priority,
      expiryTime: expiryTime.toISOString(),
      createdAt: serverTimestamp(),
      logId: log.id
    });

    const logRef = doc(db, 'foodLogs', log.id);
    await updateDoc(logRef, { status: 'listed-for-ngo' });
  }, [currentUser, userData]);

  // AI Actions Management Functions
  const addAction = useCallback(async (actionData) => {
    if (!currentUser || !db) return null;
    const docRef = await addDoc(collection(db, 'actions'), {
      hostelId: currentUser.uid,
      ...actionData,
      status: actionData.status || 'suggested',
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }, [currentUser]);

  const updateActionStatus = useCallback(async (actionId, newStatus, extraUpdates = {}) => {
    if (!db) return;
    const actionRef = doc(db, 'actions', actionId);
    await updateDoc(actionRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
      ...extraUpdates
    });
  }, []);

  const deleteAction = useCallback(async (actionId) => {
    if (!db) return;
    const actionRef = doc(db, 'actions', actionId);
    await deleteDoc(actionRef);
  }, []);

  const value = {
    listings,
    logs,
    allLogs,
    actions,
    loading,
    kpis,
    rescueFunnel,
    impactTelemetry,
    impactTimeSeries,
    baseline7Days,
    addFoodLog,
    updateLogStatus,
    createListingFromLog,
    addAction,
    updateActionStatus,
    deleteAction
  };

  return (
    <HostelDataContext.Provider value={value}>
      {children}
    </HostelDataContext.Provider>
  );
};

