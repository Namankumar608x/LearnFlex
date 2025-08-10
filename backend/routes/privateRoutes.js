// routes/privateRoute.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authmiddleware');

router.get('/private', protect, (req, res) => {
  res.json({ message: `Welcome user ${req.user.id}` });
});

module.exports = router;