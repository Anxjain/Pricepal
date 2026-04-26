const express = require('express');
const router = express.Router();

const zomatoService = require('../services/zomato');
const swiggyService = require('../services/swiggy');
const { pickBest, calcSavings } = require('../utils/estimator');
const cache = require('../utils/cache');

/**
 * GET /api/compare-food?restaurant=<name>&location=<city or coords>
 *
 * Returns price comparison across Zomato and Swiggy.
 * Partial results are returned if one platform fails.
 */
router.get('/', async (req, res) => {
  const { restaurant, location, lat, lng } = req.query;

  if (!restaurant || !location) {
    return res.status(400).json({
      error: 'Both "restaurant" and "location" query params are required.'
    });
  }

  const cacheKey = `food:${restaurant}:${location}`.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, source: 'cache' });
  }

  // Run both platform fetches in parallel; don't let one failure kill the other
  const [zomatoResult, swiggyResult] = await Promise.allSettled([
    zomatoService.getRestaurantData(restaurant, location, { lat, lng }),
    swiggyService.getRestaurantData(restaurant, location, { lat, lng }),
  ]);

  const results = [];

  if (zomatoResult.status === 'fulfilled' && zomatoResult.value) {
    results.push(zomatoResult.value);
  } else {
    console.warn('[Zomato] Failed:', zomatoResult.reason?.message);
  }

  if (swiggyResult.status === 'fulfilled' && swiggyResult.value) {
    results.push(swiggyResult.value);
  } else {
    console.warn('[Swiggy] Failed:', swiggyResult.reason?.message);
  }

  if (results.length === 0) {
    return res.status(503).json({
      error: 'Could not fetch data from any platform. Try again shortly.',
      partial: true
    });
  }

  // Mark best option and compute savings
  const ranked = pickBest(results);
  const savings = calcSavings(ranked);

  const response = {
    query: { restaurant, location },
    results: ranked,
    savings,
    partial: results.length < 2,
    disclaimer: 'Prices are estimated and may vary slightly at checkout.',
    timestamp: new Date().toISOString()
  };

  cache.set(cacheKey, response, 5 * 60); // cache for 5 mins
  res.json(response);
});

module.exports = router;
