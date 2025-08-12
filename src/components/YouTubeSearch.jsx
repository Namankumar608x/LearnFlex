import React, { useState } from 'react';
import {
  Search,
  Play,
  Eye,
  ThumbsUp,
  MessageCircle,
  Clock,
  Users,
  ArrowLeft,
} from 'lucide-react';

const YouTubeSearch = ({ onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatCount = (count) => {
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M';
    if (count >= 1_000) return (count / 1_000).toFixed(1) + 'K';
    return count.toString();
  };

  const formatDuration = (duration) => {
    if (duration === 'N/A') return duration;
    
    // Handle already formatted duration (e.g., "4:13")
    if (duration.includes(':') && !duration.startsWith('PT')) {
      return duration;
    }
    
    // Handle YouTube ISO 8601 format (PT4M13S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return duration;

    const hours = match[1] || '';
    const minutes = match[2] || '0';
    const seconds = match[3] || '0';

    return hours
      ? `${hours}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`
      : `${minutes}:${seconds.padStart(2, '0')}`;
  };

  const searchVideos = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    if (searchQuery.trim().length > 100) {
      setError('Search query too long (max 100 characters)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get token with proper fallback
      const jwtToken = localStorage.getItem('token');
      const firebaseToken = localStorage.getItem('firebase-token');
      
      const token = jwtToken || firebaseToken;
      
      if (!token) {
        setError('Please login to search videos');
        return;
      }

      const response = await fetch(
        `http://localhost:5000/api/youtube/search?query=${encodeURIComponent(
          searchQuery.trim()
        )}&maxResults=1`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setError('Authentication failed. Please login again.');
        // Optionally redirect to login
        // window.location.href = '/login';
        return;
      }

      if (response.status === 403) {
        setError('YouTube API quota exceeded. Please try again later.');
        return;
      }

      if (response.status === 400) {
        setError(data.message || 'Invalid search query');
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      if (data.success) {
        setVideos(data.data.videos || []);
        if (data.data.videos.length === 0) {
          setError(`No videos found for "${searchQuery}". Try a different search term.`);
        }
      } else {
        setError(data.message || 'Failed to search videos');
      }
    } catch (err) {
      console.error('Search error:', err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchVideos();
    }
  };

  const handleWatchVideo = (videoId) => {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4 transition-colors duration-200"
            >
              <ArrowLeft className="h-5 w-5 mr-1" />
              Back to Dashboard
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Find Educational Content
            </h1>
            <p className="text-gray-600 mt-1">
              Discover videos from top educational creators
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search for educational videos, tutorials, courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            maxLength={100}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          />
          {searchQuery.length > 80 && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
              {100 - searchQuery.length}
            </div>
          )}
        </div>
        <button
          onClick={searchVideos}
          disabled={loading || !searchQuery.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Searching...
            </div>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Searching for videos...</p>
          </div>
        </div>
      ) : (
        /* Results Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.map((video) => (
            <div
              key={video.videoId}
              className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
            >
              {/* Thumbnail */}
              <div className="relative group">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/320x180/f3f4f6/9ca3af?text=Video+Thumbnail';
                  }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                  <Play className="text-white h-12 w-12 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                </div>
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDuration(video.duration)}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 line-clamp-2 mb-2 leading-tight text-sm">
                  {video.title}
                </h3>

                {/* Creator Info */}
                <div className="flex items-center mb-3">
                  <img
                    src={video.creator.thumbnail}
                    alt={video.creator.name}
                    className="w-6 h-6 rounded-full mr-2 flex-shrink-0"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/24x24/f3f4f6/9ca3af?text=?';
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {video.creator.name}
                    </p>
                    <div className="flex items-center text-xs text-gray-500">
                      <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">
                        {formatCount(video.creator.subscriberCount)} subscribers
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <div className="flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    <span>{formatCount(video.viewCount)}</span>
                  </div>
                  <div className="flex items-center">
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    <span>{formatCount(video.likeCount)}</span>
                  </div>
                  <div className="flex items-center">
                    <MessageCircle className="h-3 w-3 mr-1" />
                    <span>{formatCount(video.commentCount)}</span>
                  </div>
                </div>

                {/* Published Date */}
                <p className="text-xs text-gray-500 mb-3">
                  {new Date(video.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>

                {/* Action Button */}
                <button
                  onClick={() => handleWatchVideo(video.videoId)}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center font-medium text-sm"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Watch on YouTube
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results State */}
      {videos.length === 0 && !loading && searchQuery && !error && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <Search className="h-full w-full" />
          </div>
          <div className="text-gray-500 text-lg font-medium">
            No videos found for "{searchQuery}"
          </div>
          <p className="text-gray-400 mt-2">
            Try different keywords or check your spelling
          </p>
        </div>
      )}

      {/* Initial State */}
      {videos.length === 0 && !loading && !searchQuery && !error && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <Search className="h-full w-full" />
          </div>
          <div className="text-gray-500 text-lg font-medium">
            Ready to search for educational content
          </div>
          <p className="text-gray-400 mt-2">
            Enter a search term above to find videos from top creators
          </p>
        </div>
      )}
    </div>
  );
};

export default YouTubeSearch;