/**
 * normalize.js
 *
 * Normalizes data from different platforms into a consistent shape.
 * This is critical — raw data from Zomato API vs Swiggy scraper
 * will have very different structures.
 */

/**
 * Normalize food/restaurant data from any platform.
 *
 * @param {Object} raw - raw platform-specific data
 * @returns {Object} normalized result
 */
function normalizeFood(raw) {
  return {
    platform: raw.platform || 'Unknown',
    restaurantName: raw.restaurantName || null,
    restaurantId: raw.restaurantId || null,
    cuisines: raw.cuisines || null,

    // Pricing (all in INR)
    avgItemPrice: toNumber(raw.avgItemPrice),
    deliveryFee: toNumber(raw.deliveryFee, 0),

    // These are set by estimator.js after normalization
    totalEstimatedPrice: null,
    isBest: false,

    // Logistics
    eta: raw.eta || 'N/A',
    rating: raw.rating ? parseFloat(raw.rating).toFixed(1) : null,

    // Navigation
    deeplink: raw.deeplink || null,

    // Metadata — important for trust display
    dataSource: raw.dataSource || 'estimated', // 'api' | 'estimated' | 'unavailable'
    confidence: raw.confidence || 'low',       // 'high' | 'medium' | 'low' | 'none'
    priceBuffer: raw.confidence === 'high' ? '±5%' :
                 raw.confidence === 'medium' ? '±15%' : '±25%',
  };
}

/**
 * Normalize cab data from any platform.
 * (Most normalization happens in cabEstimator.js and uber.js directly,
 *  this is a safety pass-through.)
 */
function normalizeCab(raw) {
  return {
    platform: raw.platform || 'Unknown',
    categories: raw.categories || [],
    price: toNumber(raw.price),
    priceRange: raw.priceRange || null,
    eta: raw.eta || 'N/A',
    surgeMultiplier: raw.surgeMultiplier || 1.0,
    deeplink: raw.deeplink || null,
    dataSource: raw.dataSource || 'estimated',
    confidence: raw.confidence || 'low',
    isBest: false,
  };
}

function toNumber(val, fallback = null) {
  const n = Number(val);
  return isNaN(n) ? fallback : Math.round(n);
}

module.exports = { normalizeFood, normalizeCab };
