const express = require('express');
const { hakiController } = require('~/server/controllers/HakiController');
const { log } = require('~/server/utils/hakiLogger');

const router = express.Router();

// Simple API Key Authentication Middleware
const requireApiKey = (req, res, next) => {
  log(`[HakiRoute] Request received at router. Method: ${req.method}, Path: ${req.path}`);
  const authHeader = req.headers['authorization'];
  // Use environment variable or fallback to 'dev-haki-key'
  const apiKey = process.env.HAKI_API_KEY || 'dev-haki-key';
  
  // Check if the provided key matches (Bearer token format)
  if (authHeader === `Bearer ${apiKey}`) {
    log('[HakiRoute] Auth successful');
    return next();
  }
  log('[HakiRoute] Auth failed', { authHeader, expected: `Bearer ${apiKey}` });
  return res.status(401).json({ error: 'Unauthorized' });
};

// Apply API Key authentication
router.use(requireApiKey);

// POST endpoint for Haki legal assistant
// Using /chat/completions to match OpenAI API standard
router.post('/chat/completions', (req, res, next) => {
  log('[HakiRoute] Routing to controller (chat/completions)');
  hakiController(req, res, next);
});

// Handle /responses path if client uses it
router.post('/responses', (req, res, next) => {
  log('[HakiRoute] Routing to controller (responses)');
  hakiController(req, res, next);
});

// Catch-all for debugging
router.use((req, res) => {
  log(`[HakiRoute] Unhandled path: ${req.path}`);
  res.status(404).json({ error: 'Not Found', path: req.path });
});

module.exports = router;
