// backend/controllers/youtubeController.js
const axios = require('axios');

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Helper function to parse YouTube duration (PT4M13S -> 4:13)
const parseDuration = (duration) => {
  if (!duration || duration === 'N/A') return 'N/A';
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Search YouTube videos
const searchVideos = async (req, res) => {
  try {
    const { query, maxResults = 20 } = req.query;
    const userId = req.user?.id || null; // Handle both JWT and Firebase auth

    // Validate required fields
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid search query is required' 
      });
    }

    // Validate maxResults
    const maxRes = Math.min(Math.max(parseInt(maxResults) || 20, 1), 50); // Limit between 1-50

    // Check if API key exists
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'YouTube API key not configured'
      });
    }

    // Log search for analytics (only for authenticated users)
    if (userId) {
      console.log(`User ${userId} searched for: "${query.trim()}"`);
    }

    // Search for videos
    const searchResponse = await axios.get(`${YOUTUBE_BASE_URL}/search`, {
      params: {
        part: 'snippet',
        q: query.trim(),
        type: 'video',
        maxResults: maxRes,
        order: 'relevance',
        key: YOUTUBE_API_KEY
      }
    });

    const videos = searchResponse.data.items;
    
    if (!videos || videos.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          videos: [],
          totalResults: 0,
          query: query.trim()
        }
      });
    }

    const videoIds = videos.map(video => video.id.videoId).join(',');

    // Get detailed video statistics
    const statsResponse = await axios.get(`${YOUTUBE_BASE_URL}/videos`, {
      params: {
        part: 'statistics,contentDetails',
        id: videoIds,
        key: YOUTUBE_API_KEY
      }
    });

    // Get channel information for creators
    const channelIds = [...new Set(videos.map(video => video.snippet.channelId))].join(','); // Remove duplicates
    const channelsResponse = await axios.get(`${YOUTUBE_BASE_URL}/channels`, {
      params: {
        part: 'snippet,statistics',
        id: channelIds,
        key: YOUTUBE_API_KEY
      }
    });

    // Create channel lookup map for better performance
    const channelMap = {};
    channelsResponse.data.items.forEach(channel => {
      channelMap[channel.id] = channel;
    });

    // Combine all data with better error handling
    const enrichedVideos = videos.map((video, index) => {
      const stats = statsResponse.data.items.find(
        stat => stat.id === video.id.videoId
      ) || {};
      
      const channel = channelMap[video.snippet.channelId] || {};

      return {
        videoId: video.id.videoId,
        title: video.snippet.title,
        description: video.snippet.description?.substring(0, 200) + '...' || 'No description available',
        thumbnail: video.snippet.thumbnails?.medium?.url || 
                  video.snippet.thumbnails?.default?.url || 
                  'https://via.placeholder.com/320x180',
        publishedAt: video.snippet.publishedAt,
        channelTitle: video.snippet.channelTitle,
        channelId: video.snippet.channelId,
        duration: parseDuration(stats?.contentDetails?.duration),
        viewCount: parseInt(stats?.statistics?.viewCount || 0),
        likeCount: parseInt(stats?.statistics?.likeCount || 0),
        commentCount: parseInt(stats?.statistics?.commentCount || 0),
        creator: {
          name: channel?.snippet?.title || video.snippet.channelTitle,
          thumbnail: channel?.snippet?.thumbnails?.default?.url || 
                    'https://via.placeholder.com/88x88',
          subscriberCount: parseInt(channel?.statistics?.subscriberCount || 0),
          videoCount: parseInt(channel?.statistics?.videoCount || 0),
          viewCount: parseInt(channel?.statistics?.viewCount || 0)
        }
      };
    });

    // Sort by creator subscriber count (top creators first)
    const sortedVideos = enrichedVideos.sort((a, b) => 
      b.creator.subscriberCount - a.creator.subscriberCount
    );

    res.status(200).json({
      success: true,
      data: {
        videos: sortedVideos,
        totalResults: searchResponse.data.pageInfo.totalResults,
        query: query.trim(),
        searchedBy: userId ? 'authenticated_user' : 'anonymous'
      }
    });

  } catch (error) {
    console.error('YouTube API Error:', error.response?.data || error.message);
    
    // Handle specific YouTube API errors
    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'YouTube API quota exceeded or invalid API key'
      });
    }
    
    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search parameters'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch YouTube videos',
      error: process.env.NODE_ENV === 'development' ? 
        (error.response?.data?.error?.message || error.message) : 
        'Internal server error'
    });
  }
};

// Get trending videos by category
const getTrendingVideos = async (req, res) => {
  try {
    const { category = 'Education', maxResults = 10 } = req.query;
    const userId = req.user?.id || null;

    // Validate maxResults
    const maxRes = Math.min(Math.max(parseInt(maxResults) || 10, 1), 25);

    // Check API key
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'YouTube API key not configured'
      });
    }

    // Log for analytics
    if (userId) {
      console.log(`User ${userId} requested trending videos for category: ${category}`);
    }

    const response = await axios.get(`${YOUTUBE_BASE_URL}/search`, {
      params: {
        part: 'snippet',
        q: category,
        type: 'video',
        maxResults: maxRes,
        order: 'viewCount',
        publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
        key: YOUTUBE_API_KEY
      }
    });

    res.status(200).json({
      success: true,
      data: {
        videos: response.data.items,
        category: category,
        timeframe: 'Last 30 days'
      }
    });

  } catch (error) {
    console.error('Trending Videos Error:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'YouTube API quota exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending videos',
      error: process.env.NODE_ENV === 'development' ? 
        (error.response?.data?.error?.message || error.message) : 
        'Internal server error'
    });
  }
};

// Get channel details
const getChannelDetails = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user?.id || null;

    if (!channelId || typeof channelId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid channel ID is required'
      });
    }

    // Check API key
    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'YouTube API key not configured'
      });
    }

    // Log for analytics
    if (userId) {
      console.log(`User ${userId} requested channel details for: ${channelId}`);
    }

    const response = await axios.get(`${YOUTUBE_BASE_URL}/channels`, {
      params: {
        part: 'snippet,statistics,contentDetails',
        id: channelId,
        key: YOUTUBE_API_KEY
      }
    });

    if (!response.data.items || response.data.items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    const channelData = response.data.items[0];
    
    // Format the response with additional useful information
    const formattedChannel = {
      ...channelData,
      statistics: {
        ...channelData.statistics,
        subscriberCount: parseInt(channelData.statistics?.subscriberCount || 0),
        videoCount: parseInt(channelData.statistics?.videoCount || 0),
        viewCount: parseInt(channelData.statistics?.viewCount || 0)
      }
    };

    res.status(200).json({
      success: true,
      data: formattedChannel
    });

  } catch (error) {
    console.error('Channel Details Error:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'YouTube API quota exceeded'
      });
    }
    
    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: 'Invalid channel ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch channel details',
      error: process.env.NODE_ENV === 'development' ? 
        (error.response?.data?.error?.message || error.message) : 
        'Internal server error'
    });
  }
};

module.exports = {
  searchVideos,
  getTrendingVideos,
  getChannelDetails
};