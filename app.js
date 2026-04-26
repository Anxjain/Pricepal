const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const foodRoutes = require('./routes/food');
const cabRoutes = require('./routes/cab');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// Rate limiting — prevent abuse
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, slow down.' }
});
app.use(limiter);

app.use('/api/compare-food', foodRoutes);
app.use('/api/compare-cab', cabRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Global error handler — never crash
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({
    error: 'Something went wrong on our end.',
    partial: true
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`PricePal backend running on :${PORT}`));

module.exports = app;
