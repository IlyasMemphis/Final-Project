const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { getProfileSummary } = require('../controllers/profileSummaryController');

// Единая ручка: /api/profile/me   или  /api/profile/:idOrUsername
router.get('/me', auth, (req, res) => getProfileSummary(req, res)); // alias
router.get('/:idOrUsername', auth, getProfileSummary);

module.exports = router;
