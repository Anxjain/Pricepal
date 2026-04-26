/**
 * estimator.js
 *
 * Core estimation and ranking logic.
 *
 * Two responsibilities:
 * 1. estimateFoodCost() — when we have zero data, generate a reasonable estimate
 * 2. pickBest() / pickBestCab() — rank results and flag the winner
 */

// ─── FOOD ESTIMATION ────────────────────────────────────────────────────────

/**
 * Category-based food cost estimator.
 *
 * When we have NO real data, we use restaurant name heuristics
 * to estimate avg price per person.
 *
 * This is admittedly rough, but it's honest — we label it as estimated.
 */
function estimateFoodCost(restaurantName) {
  const name = restaurantName.toLowerCase();

  // Premium / fine dining signals
  if (/barbeque|barbeque nation|mainland china|punjab grill|farzi/i.test(name)) {
    return { avgItemPrice: 600, tier: 'premium' };
  }

  // Mid-range chains
  if (/domino|pizza hut|kfc|mcdonalds|mcdonald|burger king|subway|wow momo|wow! momo/i.test(name)) {
    return { avgItemPrice: 250, tier: 'chain' };
  }

  // Cafe / quick service
  if (/cafe|coffee|chai|bakery|rolls|roll/i.test(name)) {
    return { avgItemPrice: 150, tier: 'cafe' };
  }

  // Biryani / North Indian / South Indian — typical neighborhood spots
  if (/biryani|dhaba|dhabha|punjabi|tandoor/i.test(name)) {
    return { avgItemPrice: 200, tier: 'casual' };
  }

  // Default: mid-range Indian
  return { avgItemPrice: 200, tier: 'unknown' };
}

/**
 * Estimate delivery fee for a platform when we don't have real data.
 */
function estimateDeliveryFee(platform, avgItemPrice) {
  const fees = {
    zomato: avgItemPrice < 300 ? 25 : 0,
    swiggy: avgItemPrice < 300 ? 30 : 0,
  };
  return fees[platform.toLowerCase()] ?? 25;
}

// ─── RANKING: FOOD ───────────────────────────────────────────────────────────

/**
 * Rank food results by total estimated cost (item price + delivery fee).
 * Marks the cheapest as best.
 */
function pickBest(results) {
  if (!results || results.length === 0) return [];

  // Compute total for each
  const withTotal = results.map(r => ({
    ...r,
    totalEstimatedPrice: (r.avgItemPrice || 0) + (r.deliveryFee || 0),
    isBest: false,
  }));

  // Sort ascending by total price
  withTotal.sort((a, b) => a.totalEstimatedPrice - b.totalEstimatedPrice);

  // Mark cheapest as best
  if (withTotal.length > 0) {
    withTotal[0].isBest = true;
  }

  return withTotal;
}

/**
 * Calculate savings vs most expensive option.
 */
function calcSavings(rankedResults) {
  if (!rankedResults || rankedResults.length < 2) return null;

  const cheapest = rankedResults[0].totalEstimatedPrice;
  const mostExpensive = rankedResults[rankedResults.length - 1].totalEstimatedPrice;
  const saved = mostExpensive - cheapest;

  if (saved <= 0) return null;

  return {
    amount: saved,
    message: `Save ₹${saved} by ordering on ${rankedResults[0].platform}`,
    percentageSaved: Math.round((saved / mostExpensive) * 100),
  };
}

// ─── RANKING: CAB ────────────────────────────────────────────────────────────

/**
 * Rank cab results by lowest estimated price.
 */
function pickBestCab(results) {
  if (!results || results.length === 0) return [];

  const valid = results.filter(r => r.price !== null);
  const invalid = results.filter(r => r.price === null);

  valid.sort((a, b) => a.price - b.price);

  if (valid.length > 0) {
    valid[0].isBest = true;
  }

  return [...valid, ...invalid];
}

/**
 * Savings message for cab comparison.
 */
function calcCabSavings(rankedResults) {
  const valid = rankedResults.filter(r => r.price !== null);
  if (valid.length < 2) return null;

  const cheapest = valid[0];
  const mostExpensive = valid[valid.length - 1];
  const saved = mostExpensive.price - cheapest.price;

  if (saved <= 5) return null; // not meaningful

  return {
    amount: saved,
    message: `${cheapest.platform} is ₹${saved} cheaper than ${mostExpensive.platform}`,
    percentageSaved: Math.round((saved / mostExpensive.price) * 100),
  };
}

module.exports = {
  estimateFoodCost,
  estimateDeliveryFee,
  pickBest,
  calcSavings,
  pickBestCab,
  calcCabSavings,
};
