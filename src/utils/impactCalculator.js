/**
 * Impact & ESG Sustainability Calculator
 * Computes quantifiable environmental, social, and financial benefits
 * from redistributed surplus food using standard scientific coefficients.
 */

import { detectCategoryFromTitle, FOOD_CATEGORIES } from './analyticsEngine';

// Conversion Factors
export const IMPACT_CONSTANTS = {
  // Average portion weight in kg (400g per meal portion)
  KG_PER_PORTION: 0.4,
  
  // Standard EPA & FAO factor: ~2.5 kg CO2e greenhouse gas emissions prevented per 1 kg food waste diverted
  CO2E_KG_PER_KG_FOOD: 2.5,

  // Water footprint equivalent: ~290 liters water saved per kg food saved
  WATER_LITERS_PER_KG_FOOD: 290,

  // Baseline average financial value per portion in INR (₹)
  DEFAULT_VALUE_PER_PORTION: 28,

  // Trees planted absorption equivalent (~21.7 kg CO2 / tree / year)
  KG_CO2_PER_TREE_YEAR: 21.7,

  // Average passenger car km per kg CO2e (~0.24 kg CO2e / km => 4.16 km / kg CO2e)
  CAR_KM_PER_KG_CO2E: 4.16,

  // Average 8-minute shower water usage in liters (~65L)
  LITERS_PER_SHOWER: 65,

  // Smartphones charged per kg CO2e (~8.22g CO2e per charge => ~121 charges / kg)
  SMARTPHONE_CHARGES_PER_KG_CO2E: 121
};

/**
 * Calculates comprehensive sustainability impact telemetry
 */
export function calculateImpactTelemetry(listings = [], logs = []) {
  const pickedUpListings = (listings || []).filter(l => l.status === 'Picked Up');

  // Total portions redistributed (realized)
  const portionsFromListings = pickedUpListings.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const portionsFromLogs = (logs || [])
    .filter(l => l.status === 'picked-up' || l.status === 'diverted')
    .reduce((sum, item) => sum + (Number(item.surplus) || 0), 0);

  const mealsRedistributed = Math.max(portionsFromListings, portionsFromLogs);

  // Total food diverted in Kilograms (kg)
  let totalDivertedKg = 0;
  let estimatedFinancialValue = 0;

  if (pickedUpListings.length > 0) {
    pickedUpListings.forEach(item => {
      const qty = Number(item.quantity) || 0;
      const catId = item.category || detectCategoryFromTitle(item.title || '');
      const catDef = FOOD_CATEGORIES.find(c => c.id === catId) || FOOD_CATEGORIES[FOOD_CATEGORIES.length - 1];

      const kg = qty * IMPACT_CONSTANTS.KG_PER_PORTION;
      totalDivertedKg += kg;
      estimatedFinancialValue += kg * catDef.avgCostPerKg;
    });
  } else {
    totalDivertedKg = mealsRedistributed * IMPACT_CONSTANTS.KG_PER_PORTION;
    estimatedFinancialValue = mealsRedistributed * IMPACT_CONSTANTS.DEFAULT_VALUE_PER_PORTION;
  }

  // Pipeline / Potential impact from pending or available listings
  const totalPrepared = (logs || []).reduce((sum, l) => sum + (Number(l.prepared) || 0), 0);
  const totalConsumed = (logs || []).reduce((sum, l) => sum + (Number(l.consumed) || 0), 0);
  const totalSurplus = (logs || []).reduce((sum, l) => sum + (Number(l.surplus) || 0), 0);
  const activePipelinePortions = Math.max(0, totalSurplus - mealsRedistributed);

  const potentialDivertedKg = Number((activePipelinePortions * IMPACT_CONSTANTS.KG_PER_PORTION).toFixed(1));
  const potentialValue = Math.round(activePipelinePortions * IMPACT_CONSTANTS.DEFAULT_VALUE_PER_PORTION);
  const potentialCo2e = Number((potentialDivertedKg * IMPACT_CONSTANTS.CO2E_KG_PER_KG_FOOD).toFixed(1));

  // Round values cleanly
  const co2eAvoidedKg = Number((totalDivertedKg * IMPACT_CONSTANTS.CO2E_KG_PER_KG_FOOD).toFixed(1));
  const waterSavedLiters = Math.round(totalDivertedKg * IMPACT_CONSTANTS.WATER_LITERS_PER_KG_FOOD);
  const treeEquivalentYears = Number((co2eAvoidedKg / IMPACT_CONSTANTS.KG_CO2_PER_TREE_YEAR).toFixed(2));

  // Environmental Equivalencies
  const carKmOffset = Math.round(co2eAvoidedKg * IMPACT_CONSTANTS.CAR_KM_PER_KG_CO2E);
  const showersSaved = Math.round(waterSavedLiters / IMPACT_CONSTANTS.LITERS_PER_SHOWER);
  const phoneCharges = Math.round(co2eAvoidedKg * IMPACT_CONSTANTS.SMARTPHONE_CHARGES_PER_KG_CO2E);

  // ESG Sustainability Score (0 - 100)
  const consumptionRate = totalPrepared > 0 ? (totalConsumed / totalPrepared) * 100 : 80;
  const redistributionRate = totalSurplus > 0 ? (mealsRedistributed / totalSurplus) * 100 : 0;
  const wasteRate = totalPrepared > 0 ? ((totalSurplus - mealsRedistributed) / totalPrepared) * 100 : 0;

  let esgScore = Math.round(
    Math.min(100, Math.max(0, (consumptionRate * 0.6) + (redistributionRate * 0.4) - (wasteRate * 0.5)))
  );
  if (totalPrepared === 0) esgScore = 75; // Baseline neutral score if no meals logged yet

  let esgGrade = 'B+';
  let esgLabel = 'Silver Tier';
  if (esgScore >= 90) { esgGrade = 'A+'; esgLabel = 'Platinum Eco Leader'; }
  else if (esgScore >= 80) { esgGrade = 'A'; esgLabel = 'Gold Sustainer'; }
  else if (esgScore >= 70) { esgGrade = 'B+'; esgLabel = 'Silver Saver'; }
  else if (esgScore >= 60) { esgGrade = 'B'; esgLabel = 'Active Contributor'; }
  else { esgGrade = 'C'; esgLabel = 'Emerging'; }

  // NGO Contribution breakdown
  const ngoBreakdown = {};
  pickedUpListings.forEach(item => {
    const ngoName = item.ngoName || 'Community Partner NGO';
    if (!ngoBreakdown[ngoName]) {
      ngoBreakdown[ngoName] = { name: ngoName, mealsRescued: 0, pickups: 0, kgRescued: 0 };
    }
    const qty = Number(item.quantity) || 0;
    ngoBreakdown[ngoName].mealsRescued += qty;
    ngoBreakdown[ngoName].kgRescued += Number((qty * IMPACT_CONSTANTS.KG_PER_PORTION).toFixed(1));
    ngoBreakdown[ngoName].pickups += 1;
  });

  return {
    mealsRedistributed,
    foodDivertedKg: Number(totalDivertedKg.toFixed(1)),
    estimatedFinancialValue: Math.round(estimatedFinancialValue),
    co2eAvoidedKg,
    waterSavedLiters,
    treeEquivalentYears,
    carKmOffset,
    showersSaved,
    phoneCharges,
    esgScore,
    esgGrade,
    esgLabel,
    activePipelinePortions,
    potentialDivertedKg,
    potentialValue,
    potentialCo2e,
    totalPickupsCompleted: pickedUpListings.length,
    ngoPartners: Object.values(ngoBreakdown).sort((a, b) => b.mealsRescued - a.mealsRescued)
  };
}

/**
 * Calculates cumulative impact time-series for charts
 */
export function calculateImpactTimeSeries(listings = []) {
  const pickedUp = (listings || [])
    .filter(l => l.status === 'Picked Up')
    .sort((a, b) => {
      const ta = a.pickedUpAt ? new Date(a.pickedUpAt).getTime() : (a.createdAt?.toMillis?.() || 0);
      const tb = b.pickedUpAt ? new Date(b.pickedUpAt).getTime() : (b.createdAt?.toMillis?.() || 0);
      return ta - tb;
    });

  let runningMeals = 0;
  let runningKg = 0;
  let runningCo2 = 0;
  let runningValue = 0;

  return pickedUp.map(item => {
    const qty = Number(item.quantity) || 0;
    const kg = qty * IMPACT_CONSTANTS.KG_PER_PORTION;
    const co2 = kg * IMPACT_CONSTANTS.CO2E_KG_PER_KG_FOOD;
    const value = qty * IMPACT_CONSTANTS.DEFAULT_VALUE_PER_PORTION;

    runningMeals += qty;
    runningKg += kg;
    runningCo2 += co2;
    runningValue += value;

    const dateStr = item.pickedUpAt 
      ? new Date(item.pickedUpAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : (item.createdAt?.toMillis ? new Date(item.createdAt.toMillis()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Recent');

    return {
      date: dateStr,
      title: item.title,
      meals: runningMeals,
      kgDiverted: Number(runningKg.toFixed(1)),
      co2eAvoided: Number(runningCo2.toFixed(1)),
      valueSaved: Math.round(runningValue)
    };
  });
}
