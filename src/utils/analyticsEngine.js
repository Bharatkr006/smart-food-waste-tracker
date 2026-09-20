/**
 * Analytics Engine for Smart Food Waste Tracker
 * Provides multi-dimensional aggregations, baseline comparisons,
 * funnel computations, and pattern extraction for AI action suggestions.
 */

// Food Category Standard Definitions & Default Estimates
export const FOOD_CATEGORIES = [
  { id: 'grains', name: 'Grains & Rice', avgCostPerKg: 40, co2PerKg: 2.1 },
  { id: 'lentils', name: 'Dal & Lentils', avgCostPerKg: 90, co2PerKg: 1.8 },
  { id: 'vegetables', name: 'Cooked Vegetables & Sabzi', avgCostPerKg: 50, co2PerKg: 1.6 },
  { id: 'breads', name: 'Roti, Naan & Breads', avgCostPerKg: 35, co2PerKg: 1.9 },
  { id: 'dairy', name: 'Dairy & Paneer', avgCostPerKg: 160, co2PerKg: 4.8 },
  { id: 'snacks', name: 'Snacks & Breakfast Items', avgCostPerKg: 60, co2PerKg: 2.2 },
  { id: 'other', name: 'Other Prepared Items', avgCostPerKg: 50, co2PerKg: 2.0 }
];

export const WASTE_TYPES = [
  { id: 'overproduction', label: 'Overproduction / Excess Prep' },
  { id: 'plate_waste', label: 'Plate Waste (Left on Plates)' },
  { id: 'spoilage', label: 'Spoilage / Quality Deterioration' },
  { id: 'expired_surplus', label: 'Unclaimed Surplus / Expired' },
  { id: 'other', label: 'Other' }
];

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

/**
 * Filter logs based on date range criteria
 */
export function filterLogsByDate(logs = [], range = '30days', customStart = null, customEnd = null) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return logs.filter(log => {
    const logTime = getLogTimestamp(log);
    if (!logTime) return true;

    switch (range) {
      case 'today':
        return logTime >= startOfDay;
      case '7days':
        return logTime >= startOfDay - 7 * 24 * 60 * 60 * 1000;
      case '30days':
        return logTime >= startOfDay - 30 * 24 * 60 * 60 * 1000;
      case 'this_month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return logTime >= monthStart;
      }
      case 'custom': {
        if (!customStart && !customEnd) return true;
        const start = customStart ? new Date(customStart).getTime() : 0;
        const end = customEnd ? new Date(customEnd).getTime() + 86400000 : Infinity;
        return logTime >= start && logTime <= end;
      }
      case 'all':
      default:
        return true;
    }
  });
}

/**
 * Extract timestamp in milliseconds from a log record
 */
export function getLogTimestamp(log) {
  if (!log) return Date.now();
  if (log.createdAt?.toMillis) return log.createdAt.toMillis();
  if (log.createdAt?.seconds) return log.createdAt.seconds * 1000;
  if (log.createdAt instanceof Date) return log.createdAt.getTime();
  if (typeof log.createdAt === 'string' || typeof log.createdAt === 'number') {
    const t = new Date(log.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (log.date) {
    const t = new Date(log.date).getTime();
    if (!isNaN(t)) return t;
  }
  return Date.now();
}

/**
 * Multi-dimensional filter
 */
export function filterLogs(logs = [], filters = {}) {
  const { dateRange = '30days', customStart, customEnd, mealType = 'all', category = 'all', status = 'all' } = filters;

  let result = filterLogsByDate(logs, dateRange, customStart, customEnd);

  if (mealType && mealType !== 'all') {
    result = result.filter(log => {
      const logMeal = (log.mealType || log.title?.split('-')[0] || '').trim().toLowerCase();
      return logMeal === mealType.toLowerCase();
    });
  }

  if (category && category !== 'all') {
    result = result.filter(log => {
      const logCat = (log.category || detectCategoryFromTitle(log.title || '')).toLowerCase();
      return logCat === category.toLowerCase();
    });
  }

  if (status && status !== 'all') {
    result = result.filter(log => (log.status || '').toLowerCase() === status.toLowerCase());
  }

  return result;
}

/**
 * Guess category from food title if not explicitly tagged
 */
export function detectCategoryFromTitle(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('rice') || lower.includes('biryani') || lower.includes('pulao') || lower.includes('grain') || lower.includes('khichdi')) return 'grains';
  if (lower.includes('dal') || lower.includes('sambar') || lower.includes('rajma') || lower.includes('chole') || lower.includes('lentil')) return 'lentils';
  if (lower.includes('roti') || lower.includes('chapati') || lower.includes('naan') || lower.includes('paratha') || lower.includes('puri') || lower.includes('bread')) return 'breads';
  if (lower.includes('paneer') || lower.includes('curd') || lower.includes('milk') || lower.includes('raita') || lower.includes('butter')) return 'dairy';
  if (lower.includes('sabzi') || lower.includes('curry') || lower.includes('aloo') || lower.includes('gobi') || lower.includes('veg') || lower.includes('salad')) return 'vegetables';
  if (lower.includes('sandwich') || lower.includes('poha') || lower.includes('upma') || lower.includes('idli') || lower.includes('dosa') || lower.includes('snack')) return 'snacks';
  return 'other';
}

/**
 * Computes core KPI metrics with clean separation of Surplus vs Diverted vs Net Waste
 */
export function computeCoreMetrics(logs = [], listings = []) {
  if (!logs || logs.length === 0) {
    return {
      totalPrepared: 0,
      totalConsumed: 0,
      totalSurplus: 0,
      totalDiverted: 0,
      totalNetWaste: 0,
      consumptionRate: 0,
      wasteRate: 0,
      redistributionRate: 0,
      pickupSuccessRate: 0,
      logCount: 0
    };
  }

  const totalPrepared = logs.reduce((acc, curr) => acc + (Number(curr.prepared) || 0), 0);
  const totalConsumed = logs.reduce((acc, curr) => acc + (Number(curr.consumed) || 0), 0);
  const totalSurplus = logs.reduce((acc, curr) => acc + (Number(curr.surplus) || 0), 0);

  // Compute diverted portions from listings or picked-up logs
  const pickedUpListings = (listings || []).filter(l => l.status === 'Picked Up');
  const totalDivertedFromListings = pickedUpListings.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  
  // Or from logs marked as 'picked-up' / 'diverted'
  const totalDivertedFromLogs = logs
    .filter(l => l.status === 'picked-up' || l.status === 'diverted')
    .reduce((acc, curr) => acc + (Number(curr.surplus) || 0), 0);

  const totalDiverted = Math.max(totalDivertedFromListings, totalDivertedFromLogs);
  const totalNetWaste = Math.max(0, totalSurplus - totalDiverted);

  const consumptionRate = totalPrepared > 0 ? ((totalConsumed / totalPrepared) * 100).toFixed(1) : 0;
  const wasteRate = totalPrepared > 0 ? ((totalNetWaste / totalPrepared) * 100).toFixed(1) : 0;
  const redistributionRate = totalSurplus > 0 ? ((totalDiverted / totalSurplus) * 100).toFixed(1) : 0;

  const totalListed = (listings || []).length;
  const totalPickedUp = pickedUpListings.length;
  const pickupSuccessRate = totalListed > 0 ? ((totalPickedUp / totalListed) * 100).toFixed(1) : 0;

  return {
    totalPrepared,
    totalConsumed,
    totalSurplus,
    totalDiverted,
    totalNetWaste,
    consumptionRate: Number(consumptionRate),
    wasteRate: Number(wasteRate),
    redistributionRate: Number(redistributionRate),
    pickupSuccessRate: Number(pickupSuccessRate),
    logCount: logs.length
  };
}

/**
 * Computes the complete Food Rescue Funnel
 */
export function computeRescueFunnel(logs = [], listings = []) {
  const totalPrepared = logs.reduce((acc, curr) => acc + (Number(curr.prepared) || 0), 0);
  const totalConsumed = logs.reduce((acc, curr) => acc + (Number(curr.consumed) || 0), 0);
  const totalSurplus = logs.reduce((acc, curr) => acc + (Number(curr.surplus) || 0), 0);

  const totalListed = (listings || []).reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalAccepted = (listings || [])
    .filter(l => l.status === 'Accepted' || l.status === 'Picked Up')
    .reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const totalPickedUp = (listings || [])
    .filter(l => l.status === 'Picked Up')
    .reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

  const unrecoveredWaste = Math.max(0, totalSurplus - totalPickedUp);

  return [
    { stage: 'Prepared', value: totalPrepared, fill: '#3b82f6', description: 'Total food prepared' },
    { stage: 'Consumed', value: totalConsumed, fill: '#10b981', description: 'Eaten by students/residents' },
    { stage: 'Surplus', value: totalSurplus, fill: '#f59e0b', description: 'Remaining unconsumed food' },
    { stage: 'Listed for NGO', value: totalListed || Math.min(totalSurplus, totalListed), fill: '#6366f1', description: 'Published for donation' },
    { stage: 'Accepted', value: totalAccepted, fill: '#8b5cf6', description: 'Claimed by partner NGOs' },
    { stage: 'Picked Up', value: totalPickedUp, fill: '#059669', description: 'Successfully redistributed' },
    { stage: 'Net Waste', value: unrecoveredWaste, fill: '#ef4444', description: 'Unrecovered surplus' }
  ];
}

/**
 * Computes Most Wasted Food Items
 */
export function computeMostWastedItems(logs = []) {
  const map = {};

  logs.forEach(log => {
    const rawName = log.foodItem || (log.title?.includes('-') ? log.title.split('-')[1] : log.title) || 'Unknown';
    const name = rawName.trim();
    const surplus = Number(log.surplus) || 0;
    const prepared = Number(log.prepared) || 0;

    if (!map[name]) {
      map[name] = { name, totalSurplus: 0, totalPrepared: 0, count: 0 };
    }
    map[name].totalSurplus += surplus;
    map[name].totalPrepared += prepared;
    map[name].count += 1;
  });

  const totalAllSurplus = Object.values(map).reduce((acc, i) => acc + i.totalSurplus, 0) || 1;

  return Object.values(map)
    .map(item => ({
      ...item,
      wastePercentage: item.totalPrepared > 0 ? ((item.totalSurplus / item.totalPrepared) * 100).toFixed(1) : 0,
      shareOfTotalWaste: ((item.totalSurplus / totalAllSurplus) * 100).toFixed(1)
    }))
    .sort((a, b) => b.totalSurplus - a.totalSurplus)
    .slice(0, 7);
}

/**
 * Computes Waste by Meal Type
 */
export function computeWasteByMeal(logs = []) {
  const meals = {
    Breakfast: { name: 'Breakfast', prepared: 0, consumed: 0, surplus: 0 },
    Lunch: { name: 'Lunch', prepared: 0, consumed: 0, surplus: 0 },
    Dinner: { name: 'Dinner', prepared: 0, consumed: 0, surplus: 0 },
    Snacks: { name: 'Snacks', prepared: 0, consumed: 0, surplus: 0 }
  };

  logs.forEach(log => {
    let meal = log.mealType;
    if (!meal && log.title?.includes('-')) {
      meal = log.title.split('-')[0].trim();
    }
    if (!meals[meal]) meal = 'Lunch';

    meals[meal].prepared += Number(log.prepared) || 0;
    meals[meal].consumed += Number(log.consumed) || 0;
    meals[meal].surplus += Number(log.surplus) || 0;
  });

  return Object.values(meals).map(m => ({
    ...m,
    wasteRate: m.prepared > 0 ? Number(((m.surplus / m.prepared) * 100).toFixed(1)) : 0
  }));
}

/**
 * Computes Waste by Category
 */
export function computeWasteByCategory(logs = []) {
  const catMap = {};
  FOOD_CATEGORIES.forEach(c => {
    catMap[c.id] = { id: c.id, name: c.name, prepared: 0, consumed: 0, surplus: 0 };
  });

  logs.forEach(log => {
    const catId = log.category || detectCategoryFromTitle(log.title || '');
    if (!catMap[catId]) {
      catMap[catId] = { id: catId, name: catId, prepared: 0, consumed: 0, surplus: 0 };
    }
    catMap[catId].prepared += Number(log.prepared) || 0;
    catMap[catId].consumed += Number(log.consumed) || 0;
    catMap[catId].surplus += Number(log.surplus) || 0;
  });

  return Object.values(catMap)
    .filter(c => c.prepared > 0 || c.surplus > 0)
    .map(c => ({
      ...c,
      wasteRate: c.prepared > 0 ? Number(((c.surplus / c.prepared) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.surplus - a.surplus);
}

/**
 * Computes Waste by Day of the Week (Mon - Sun)
 */
export function computeWasteByDayOfWeek(logs = []) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayStats = days.map(name => ({ day: name.slice(0, 3), fullName: name, prepared: 0, consumed: 0, surplus: 0 }));

  logs.forEach(log => {
    const time = getLogTimestamp(log);
    const dayIndex = new Date(time).getDay();
    dayStats[dayIndex].prepared += Number(log.prepared) || 0;
    dayStats[dayIndex].consumed += Number(log.consumed) || 0;
    dayStats[dayIndex].surplus += Number(log.surplus) || 0;
  });

  return dayStats.map(d => ({
    ...d,
    wasteRate: d.prepared > 0 ? Number(((d.surplus / d.prepared) * 100).toFixed(1)) : 0
  }));
}

/**
 * Computes Period-over-Period Baseline Comparisons
 */
export function computeBaselineComparison(logs = [], periodDays = 7) {
  const now = Date.now();
  const msPerDay = 86400000;
  const currentStart = now - periodDays * msPerDay;
  const previousStart = now - 2 * periodDays * msPerDay;

  const currentLogs = logs.filter(l => {
    const t = getLogTimestamp(l);
    return t >= currentStart && t <= now;
  });

  const previousLogs = logs.filter(l => {
    const t = getLogTimestamp(l);
    return t >= previousStart && t < currentStart;
  });

  const currentMetrics = computeCoreMetrics(currentLogs);
  const previousMetrics = computeCoreMetrics(previousLogs);

  const calculateDelta = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Number((((curr - prev) / prev) * 100).toFixed(1));
  };

  return {
    currentPeriod: {
      days: periodDays,
      ...currentMetrics
    },
    previousPeriod: {
      days: periodDays,
      ...previousMetrics
    },
    deltas: {
      wasteRateDelta: Number((currentMetrics.wasteRate - previousMetrics.wasteRate).toFixed(1)),
      wasteRatePercentChange: calculateDelta(currentMetrics.wasteRate, previousMetrics.wasteRate),
      surplusDelta: currentMetrics.totalSurplus - previousMetrics.totalSurplus,
      consumptionRateDelta: Number((currentMetrics.consumptionRate - previousMetrics.consumptionRate).toFixed(1)),
      redistributionRateDelta: Number((currentMetrics.redistributionRate - previousMetrics.redistributionRate).toFixed(1))
    }
  };
}

/**
 * Extracts structured statistics payload tailored for Gemini AI Action recommendations
 */
export function extractStatisticalSummaryForAI(logs = [], listings = [], actions = []) {
  const metrics = computeCoreMetrics(logs, listings);
  const mostWasted = computeMostWastedItems(logs);
  const meals = computeWasteByMeal(logs);
  const days = computeWasteByDayOfWeek(logs);
  const baseline = computeBaselineComparison(logs, 7);

  return {
    totalLogs: logs.length,
    overallWasteRate: `${metrics.wasteRate}%`,
    overallConsumptionRate: `${metrics.consumptionRate}%`,
    redistributionRate: `${metrics.redistributionRate}%`,
    pickupSuccessRate: `${metrics.pickupSuccessRate}%`,
    topWastedItems: mostWasted.slice(0, 3).map(i => ({
      item: i.name,
      surplusPortions: i.totalSurplus,
      itemWasteRate: `${i.wastePercentage}%`
    })),
    wasteByMeal: meals.map(m => ({
      meal: m.name,
      wasteRate: `${m.wasteRate}%`,
      surplus: m.surplus
    })),
    highestWasteDay: [...days].sort((a, b) => b.wasteRate - a.wasteRate)[0] || null,
    sevenDayTrend: baseline.deltas.wasteRateDelta < 0 ? 'Decreasing' : 'Increasing',
    activeActionCount: (actions || []).filter(a => a.status === 'active').length
  };
}
