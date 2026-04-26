/**
 * uber.js
 *
 * Uses Uber's official Price Estimates API.
 *
 * Setup:
 * 1. Go to https://developer.uber.com/
 * 2. Create an app
 * 3. Request access to "Price Estimates" (sandbox is immediate, production takes 1–2 days)
 * 4. Use server_token for this endpoint (no OAuth needed for estimates)
 *
 * Endpoint: GET /v1.2/estimates/price
 * Docs: https://developer.uber.com/docs/riders/references/api/v1.2/estimates-price-get
 *
 * Limitation: Requires lat/lng, NOT address strings.
 * → We geocode the addresses first using Google Maps.
 */

const axios = require('axios');
const mapsService = require('./maps');
const { normalizeFood } = require('../utils/normalize');

const UBER_SERVER_TOKEN = process.env.UBER_SERVER_TOKEN;
const UBER_API_BASE = 'https://api.uber.com/v1.2';

async function getFareEstimate(pickup, drop, distanceKm = null) {
  if (!UBER_SERVER_TOKEN) {
    throw new Error('Uber server token not configured');
  }

  // Geocode both addresses
  const [pickupCoords, dropCoords] = await Promise.all([
    mapsService.geocode(pickup),
    mapsService.geocode(drop),
  ]);

  if (!pickupCoords || !dropCoords) {
    throw new Error('Could not geocode pickup/drop for Uber API');
  }

  const res = await axios.get(`${UBER_API_BASE}/estimates/price`, {
    params: {
      start_latitude: pickupCoords.lat,
      start_longitude: pickupCoords.lng,
      end_latitude: dropCoords.lat,
      end_longitude: dropCoords.lng,
    },
    headers: {
      Authorization: `Token ${UBER_SERVER_TOKEN}`,
      'Accept-Language': 'en_IN',
      'Content-Type': 'application/json',
    },
    timeout: 8000,
  });

  const prices = res.data?.prices;
  if (!prices || prices.length === 0) {
    throw new Error('No price estimates returned from Uber');
  }

  // Return each product type (UberGo, Moto, Premier, etc.)
  const categories = prices
    .filter(p => p.estimate && p.estimate !== 'Unavailable')
    .map(p => {
      // Uber returns "₹200-₹250" or just "₹220"
      const [min, max] = parseUberEstimate(p.estimate);

      return {
        type: p.display_name,
        priceMin: min,
        priceMax: max,
        estimatedPrice: Math.round((min + max) / 2),
        surgeMultiplier: p.surge_multiplier || 1.0,
      };
    });

  const headline = categories.sort((a, b) => a.estimatedPrice - b.estimatedPrice)[0];

  return {
    platform: 'Uber',
    categories,
    price: headline.estimatedPrice,
    priceRange: `₹${headline.priceMin}–₹${headline.priceMax}`,
    eta: formatETA(prices[0]?.duration),
    surgeMultiplier: headline.surgeMultiplier,
    deeplink: buildUberDeepLink(pickupCoords, dropCoords),
    dataSource: 'api', // Uber data is real
    confidence: 'high',
    isBest: false
  };
}

function parseUberEstimate(estimate) {
  // Handle formats: "₹200-₹250", "₹220", "$20-$25"
  const cleaned = estimate.replace(/[₹$,]/g, '').trim();

  if (cleaned.includes('-')) {
    const [min, max] = cleaned.split('-').map(Number);
    return [min, max];
  }

  const val = Number(cleaned);
  return [Math.round(val * 0.9), Math.round(val * 1.1)];
}

function formatETA(durationSeconds) {
  if (!durationSeconds) return '5–15 min';
  const mins = Math.round(durationSeconds / 60);
  return `${mins} min`;
}

function buildUberDeepLink(pickup, drop) {
  // Uber universal link format
  return `https://m.uber.com/ul/?action=setPickup` +
    `&pickup[latitude]=${pickup.lat}&pickup[longitude]=${pickup.lng}` +
    `&dropoff[latitude]=${drop.lat}&dropoff[longitude]=${drop.lng}`;
}

module.exports = { getFareEstimate };
