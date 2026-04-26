/**
 * maps.js
 *
 * Calculates driving distance and duration between two points.
 * Uses Google Maps Distance Matrix API.
 *
 * Free tier: 40,000 elements/month = ~1,300/day → fine for MVP.
 * Cost after that: $5 per 1,000 elements (use caching!)
 *
 * Get API key: https://console.cloud.google.com/
 * Enable: "Distance Matrix API" and "Geocoding API"
 */

const axios = require('axios');

const MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BASE_URL = 'https://maps.googleapis.com/maps/api';

/**
 * Get driving route info between two addresses or coordinates.
 *
 * @param {string} origin - address or "lat,lng"
 * @param {string} destination - address or "lat,lng"
 * @returns {{ distanceKm: number, durationMin: number, distanceText: string, durationText: string }}
 */
async function getRoute(origin, destination) {
  if (!MAPS_API_KEY) {
    console.warn('[Maps] No API key set, using fallback estimation');
    return estimateDistanceFallback(origin, destination);
  }

  const res = await axios.get(`${BASE_URL}/distancematrix/json`, {
    params: {
      origins: origin,
      destinations: destination,
      mode: 'driving',
      units: 'metric',
      key: MAPS_API_KEY,
      region: 'in', // India bias
      language: 'en-IN',
    },
    timeout: 5000,
  });

  const data = res.data;

  if (data.status !== 'OK') {
    throw new Error(`Maps API error: ${data.status}`);
  }

  const element = data.rows?.[0]?.elements?.[0];

  if (!element || element.status !== 'OK') {
    throw new Error(`Route not found: ${element?.status}`);
  }

  return {
    distanceKm: element.distance.value / 1000,
    durationMin: Math.round(element.duration.value / 60),
    distanceText: element.distance.text,
    durationText: element.duration.text,
    fallback: false,
  };
}

/**
 * Geocode a text address to coordinates.
 * Useful when user types a neighborhood name.
 */
async function geocode(address) {
  if (!MAPS_API_KEY) return null;

  const res = await axios.get(`${BASE_URL}/geocode/json`, {
    params: {
      address,
      key: MAPS_API_KEY,
      region: 'in',
    },
    timeout: 5000,
  });

  const result = res.data?.results?.[0];
  if (!result) return null;

  const loc = result.geometry.location;
  return { lat: loc.lat, lng: loc.lng, formattedAddress: result.formatted_address };
}

/**
 * Fallback when Maps API is unavailable.
 *
 * Rough estimation based on typical Indian city patterns.
 * NOT accurate — used only when API key is missing or API is down.
 */
function estimateDistanceFallback(origin, destination) {
  // We can't compute real distance without geocoding.
  // Return a null signal so the cab estimator knows to use its own fallback.
  return {
    distanceKm: null,
    durationMin: null,
    distanceText: 'Unknown',
    durationText: 'Unknown',
    fallback: true,
  };
}

module.exports = { getRoute, geocode };
