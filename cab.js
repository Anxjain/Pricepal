const express = require('express');
const router = express.Router();

const uberService = require('../services/uber');
const cabEstimator = require('../services/cabEstimator');
const mapsService = require('../services/maps');
const { pickBestCab, calcCabSavings } = require('../utils/estimator');
const cache = require('../utils/cache');

/**
 * GET /api/compare-cab?pickup=<addr>&drop=<addr>
 *
 * Returns fare comparison across Uber, Ola, Rapido.
 */
router.get('/', async (req, res) => {
  const { pickup, drop } = req.query;

  if (!pickup || !drop) {
    return res.status(400).json({
      error: 'Both "pickup" and "drop" query params are required.'
    });
  }

  const cacheKey = `cab:${pickup}:${drop}`.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, source: 'cache' });
  }

  // First get distance/duration from Google Maps (or fallback estimator)
  let routeInfo;
  try {
    routeInfo = await mapsService.getRoute(pickup, drop);
  } catch (err) {
    console.warn('[Maps] Failed, using fallback estimator:', err.message);
    routeInfo = { distanceKm: null, durationMin: null, fallback: true };
  }

  const { distanceKm, durationMin } = routeInfo;

  // Run all three in parallel
  const [uberResult, olaResult, rapidoResult] = await Promise.allSettled([
    uberService.getFareEstimate(pickup, drop, distanceKm),
    cabEstimator.estimate('ola', distanceKm, durationMin),
    cabEstimator.estimate('rapido', distanceKm, durationMin),
  ]);

  const results = [];

  if (uberResult.status === 'fulfilled' && uberResult.value) {
    results.push(uberResult.value);
  } else {
    console.warn('[Uber] Failed:', uberResult.reason?.message);
    // Fallback: estimate Uber too
    const ubFallback = await cabEstimator.estimate('uber', distanceKm, durationMin).catch(() => null);
    if (ubFallback) results.push(ubFallback);
  }

  if (olaResult.status === 'fulfilled' && olaResult.value) results.push(olaResult.value);
  if (rapidoResult.status === 'fulfilled' && rapidoResult.value) results.push(rapidoResult.value);

  if (results.length === 0) {
    return res.status(503).json({
      error: 'Could not compute fare estimates. Check your locations.',
      partial: true
    });
  }

  const ranked = pickBestCab(results);
  const savings = calcCabSavings(ranked);

  const response = {
    query: { pickup, drop },
    route: routeInfo,
    results: ranked,
    savings,
    partial: results.length < 3,
    disclaimer: 'Cab prices are estimates based on base rates + surge multipliers. Actual fare may vary.',
    timestamp: new Date().toISOString()
  };

  cache.set(cacheKey, response, 3 * 60); // cache for 3 mins (cab prices change fast)
  res.json(response);
});

module.exports = router;
