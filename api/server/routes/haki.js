const express = require('express');
const { hakiController } = require('~/server/controllers/HakiController');

const router = express.Router();

// Simple API Key Authentication Middleware
const requireApiKey = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Use environment variable or fallback to 'dev-haki-key'
  const apiKey = process.env.HAKI_API_KEY || 'dev-haki-key';
  
  // Check if the provided key matches (Bearer token format)
  if (authHeader === `Bearer ${apiKey}`) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

// Apply API Key authentication
router.use(requireApiKey);

// POST endpoint for Haki legal assistant
// Using /chat/completions to match OpenAI API standard
router.post('/chat/completions', hakiController);

module.exports = router;
