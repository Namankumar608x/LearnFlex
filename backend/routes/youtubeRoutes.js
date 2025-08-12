// backend/routes/youtubeRoutes.js
const express = require('express');
const router = express.Router();
const { 
  searchVideos, 
  getTrendingVideos, 
  getChannelDetails 
} = require('../controllers/youtubeController');

const protect = require('../middleware/authmiddleware');

// Input validation middleware
const validateSearchQuery = (req, res, next) => {
  const { query } = req.query;
  
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Search query is required and must be a non-empty string'
    });
  }
  
  if (query.trim().length > 100) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be less than 100 characters'
    });
  }
  
  // Sanitize query
  req.query.query = query.trim();
  next();
};

const validateChannelId = (req, res, next) => {
  const { channelId } = req.params;
  
  if (!channelId || typeof channelId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Valid channel ID is required'
    });
  }
  
  // Basic YouTube channel ID format validation (starts with UC and 22 chars total)
  if (!/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid YouTube channel ID format'
    });
  }
  
  next();
};

// @route   GET /api/youtube/search
// @desc    Search YouTube videos
// @access  Private (Protected) - Requires authentication
router.get('/search', protect, validateSearchQuery, searchVideos);

// @route   GET /api/youtube/trending  
// @desc    Get trending videos by category
// @access  Private (Protected) - Requires authentication
router.get('/trending', protect, getTrendingVideos);

// @route   GET /api/youtube/channel/:channelId
// @desc    Get channel details
// @access  Private (Protected) - Requires authentication  
router.get('/channel/:channelId', protect, validateChannelId, getChannelDetails);

// Health check endpoint for YouTube API
// @route   GET /api/youtube/health
// @desc    Check if YouTube API is working
// @access  Private (Protected)
router.get('/health', protect, (req, res) => {
  const apiKeyExists = !!process.env.YOUTUBE_API_KEY;
  
  res.status(200).json({
    success: true,
    message: 'YouTube service is running',
    data: {
      apiKeyConfigured: apiKeyExists,
      timestamp: new Date().toISOString(),
      userType: req.authType || 'unknown'
    }
  });
});

// Error handling middleware specific to YouTube routes
router.use((error, req, res, next) => {
  console.error('YouTube Routes Error:', error);
  
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: 'YouTube API service temporarily unavailable'
    });
  }
  
  if (error.response?.status === 403) {
    return res.status(403).json({
      success: false,
      message: 'YouTube API quota exceeded. Please try again later.'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'YouTube service error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;