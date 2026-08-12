const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/turn-credentials
// Issues short-lived STUN+TURN server credentials via Metered's Open Relay service.
// A direct STUN-only connection fails whenever both peers sit behind restrictive/
// symmetric NATs or firewalls - common across different countries, mobile carriers,
// or corporate networks - which is exactly the case a plain STUN server can't solve.
// TURN relays the media through a third-party server instead of requiring a direct
// peer path. (Note: Azure Communication Services previously offered a built-in TURN
// issuance API, but Microsoft fully retired that specific feature in March 2024 -
// Metered's free tier is the practical replacement.)
const METERED_API_KEY = process.env.METERED_API_KEY;
const METERED_SUBDOMAIN = process.env.METERED_SUBDOMAIN;

const FALLBACK_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

router.get('/', async (req, res) => {
  if (!METERED_API_KEY || !METERED_SUBDOMAIN) {
    // Not configured (e.g. local dev without it set up) - fall back to STUN-only
    return res.json({ iceServers: FALLBACK_ICE_SERVERS });
  }

  try {
    const response = await fetch(
      `https://${METERED_SUBDOMAIN}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
    );
    if (!response.ok) throw new Error(`Metered API returned ${response.status}`);
    const iceServers = await response.json();
    res.json({ iceServers });
  } catch (err) {
    console.error('Failed to fetch TURN credentials from Metered:', err);
    // Degrade gracefully to STUN-only rather than blocking the call entirely
    res.json({ iceServers: FALLBACK_ICE_SERVERS });
  }
});

module.exports = router;
