# PricePal — Price Comparison MVP
## Food Delivery + Cab Fares across Indian platforms

---

## What This Is

A web MVP that compares:
- **Food**: Zomato vs Swiggy (prices, delivery fee, ETA)
- **Cabs**: Uber vs Ola vs Rapido (fare estimates, pickup time)

Not a super-app. Not handling checkout. Just: *compare fast, decide smart.*

---

## Folder Structure

```
pricepal/
├── backend/
│   ├── src/
│   │   ├── app.js                    ← Express server entry
│   │   ├── routes/
│   │   │   ├── food.js               ← GET /api/compare-food
│   │   │   └── cab.js                ← GET /api/compare-cab
│   │   ├── services/
│   │   │   ├── zomato.js             ← Zomato public API
│   │   │   ├── swiggy.js             ← Swiggy internal API + fallback
│   │   │   ├── uber.js               ← Uber Price Estimates API
│   │   │   ├── cabEstimator.js       ← Ola + Rapido estimation engine
│   │   │   └── maps.js               ← Google Maps distance/geocoding
│   │   └── utils/
│   │       ├── estimator.js          ← Ranking + savings logic
│   │       ├── cache.js              ← In-memory TTL cache
│   │       └── normalize.js          ← Data shape normalization
│   ├── package.json
│   └── .env.example
└── frontend/
    └── index.html                    ← Single-file React app (no build needed)
```

---

## Step-by-Step Setup

### 1. Get API Keys

**Required:**
- **Google Maps API** — https://console.cloud.google.com/
  - Enable: Distance Matrix API + Geocoding API
  - Free tier: ~1,300 requests/day
  - Cost after: $5/1,000 requests

**Strongly recommended:**
- **Zomato Public API** — https://developers.zomato.com/api
  - Free: 1,000 calls/day
  - No approval needed, instant key

**Optional (better Uber data):**
- **Uber Developer** — https://developer.uber.com/
  - Create app → get Server Token
  - Price Estimates endpoint doesn't need user OAuth

---

### 2. Backend Setup

```bash
cd backend
npm install

# Copy env file and add your keys
cp .env.example .env
# → Edit .env with your API keys

npm run dev
# Server starts on http://localhost:4000
```

**Test it:**
```bash
# Food comparison
curl "http://localhost:4000/api/compare-food?restaurant=Dominos&location=Gurgaon"

# Cab comparison
curl "http://localhost:4000/api/compare-cab?pickup=Cyber+City+Gurgaon&drop=Connaught+Place+Delhi"
```

---

### 3. Frontend Setup

The frontend is a **single HTML file** — no build step required.

```bash
# Option A: Just open it
open frontend/index.html

# Option B: Serve it (for CORS to work with local backend)
npx serve frontend
# → http://localhost:3000
```

**Connect to real backend:**
In `frontend/index.html`, find this line in the `App` component and uncomment the real API call:
```js
// In ResultsPage useEffect, replace the mock timeout with:
const fn = searchParams.mode === 'food' ? compareFood : compareCab;
const result = await fn(searchParams.query, searchParams.location);
setData(result);
```

---

## API Response Shapes

### Food Comparison Response
```json
{
  "query": { "restaurant": "Domino's", "location": "Gurgaon" },
  "results": [
    {
      "platform": "Zomato",
      "restaurantName": "Domino's Pizza",
      "avgItemPrice": 250,
      "deliveryFee": 25,
      "totalEstimatedPrice": 275,
      "eta": "28–38 min",
      "rating": "3.9",
      "deeplink": "https://www.zomato.com/...",
      "dataSource": "api",
      "confidence": "high",
      "priceBuffer": "±5%",
      "isBest": true
    }
  ],
  "savings": {
    "amount": 15,
    "message": "Save ₹15 by ordering on Zomato",
    "percentageSaved": 5
  },
  "partial": false,
  "disclaimer": "Prices are estimated and may vary slightly at checkout."
}
```

### Cab Comparison Response
```json
{
  "query": { "pickup": "Cyber City", "drop": "Connaught Place" },
  "route": { "distanceKm": 26, "durationMin": 45 },
  "results": [
    {
      "platform": "Uber",
      "categories": [
        { "type": "UberGo", "estimatedPrice": 380, "priceMin": 350, "priceMax": 410 }
      ],
      "price": 380,
      "priceRange": "₹350–₹410",
      "eta": "5 min",
      "isBest": false
    }
  ],
  "savings": { "amount": 200, "message": "Rapido Bike is ₹200 cheaper than Uber" }
}
```

---

## Confidence Levels Explained

| Level  | Meaning                                    | Price Buffer |
|--------|--------------------------------------------|--------------|
| High   | Real API data (Zomato API, Uber API)       | ±5%          |
| Medium | Unofficial API / partial data              | ±15%         |
| Low    | Pure estimation from rate cards            | ±25%         |
| None   | Missing location data, cannot estimate     | N/A          |

---

## What Can Break + How to Handle It

| Issue | What Happens | Fix |
|-------|-------------|-----|
| Zomato API down | Returns 503, Swiggy-only results shown | ✅ Handled via Promise.allSettled |
| Swiggy API changes | Falls back to estimation engine | ✅ Try/catch with fallback |
| Maps API quota exceeded | Cab fares estimated without distance | ⚠️ Add Redis caching to reduce calls |
| Uber API unavailable | Uber uses estimation like Ola/Rapido | ✅ Handled in cab.js |
| Restaurant not found | Returns `null`, excluded from results | ✅ Logged, partial result returned |

---

## Next Steps (Phase 2)

1. **Real-time prices**: Add Puppeteer scraping for Swiggy (run on EC2, not serverless)
2. **User accounts**: Firebase Auth + saved searches
3. **Alerts**: "Notify me when Zomato drops delivery fee" — Firebase Cloud Messaging
4. **Cab deeplinks**: Preload Uber/Ola apps with pickup location via universal links
5. **Dish-level comparison**: After restaurant match works, extend to specific items
6. **Rapido Bike for food**: Rapido is piloting food delivery — add when API available
