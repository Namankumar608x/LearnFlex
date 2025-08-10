import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FF8042"];

function Dashboard() {
  const [user, setUser] = useState(null);
  const [leetcodeHandle, setLeetcodeHandle] = useState("");
  const [gfgHandle, setGfgHandle] = useState("");
  const [leetcodeStats, setLeetcodeStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    let authMethod = null; // Track which auth method is being used
    
    // Check for token-based authentication first
    const token = localStorage.getItem("token");
    console.log("Token found in localStorage:", !!token);
    
    if (token) {
      // User is authenticated via token (traditional login)
      authMethod = "token";
      console.log("Using token-based authentication");
      
      // Create a mock user object for token-based auth
      const tokenUser = {
        uid: "token-user", // You might want to decode this from JWT
        email: "token-authenticated-user", // Get from JWT or API call
        displayName: "Token User",
        photoURL: null
      };
      
      setUser(tokenUser);
      setLoading(false);
      
      // Don't start Firebase auth listener for token users
      return () => {
        mounted = false;
      };
    }

    // No token found, check Firebase authentication
    console.log("No token found, checking Firebase authentication");
    authMethod = "firebase";
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Firebase auth state changed:", currentUser ? "User logged in" : "No user");
      
      if (!mounted) return;
      
      if (!currentUser) {
        console.log("No Firebase user found, redirecting to login");
        setLoading(false);
        navigate("/login");
        return;
      }

      // User is authenticated via Firebase
      try {
        const firebaseToken = await currentUser.getIdToken();
        localStorage.setItem("firebase-token", firebaseToken); // Store separately from JWT token
        setUser(currentUser);
        console.log("Firebase user authenticated:", currentUser.email);

        // Fetch user data from Firestore
        const userRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists() && mounted) {
          const data = docSnap.data();
          setLeetcodeHandle(data.leetcode || "");
          setGfgHandle(data.gfg || "");
          console.log("User data loaded from Firestore");
        }
      } catch (error) {
        console.error("Error with Firebase authentication:", error);
        if (mounted) {
          navigate("/login");
        }
      }

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (leetcodeHandle && user) {
      fetchLeetCodeStats(leetcodeHandle);
    }
  }, [leetcodeHandle, user]);

  const fetchLeetCodeStats = async (username) => {
    try {
      // Get the appropriate token
      const token = localStorage.getItem("token");
      const firebaseToken = localStorage.getItem("firebase-token");
      const authToken = token || firebaseToken;
      
      if (!authToken) {
        throw new Error("No authentication token found");
      }

      console.log("Using auth token:", authToken ? "Token present" : "No token");

      // GraphQL query for LeetCode stats
      const query = `
        query getUserProfile($username: String!) {
          matchedUser(username: $username) {
            submitStatsGlobal {
              acSubmissionNum {
                difficulty
                count
              }
            }
          }
        }
      `;

      const response = await fetch('http://localhost:5000/api/leetcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          query: query,
          variables: { username: username }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ LeetCode API Response:", result);

      if (result.data && result.data.matchedUser && result.data.matchedUser.submitStatsGlobal) {
        const submissions = result.data.matchedUser.submitStatsGlobal.acSubmissionNum;
        
        const statsMap = {};
        submissions.forEach(item => {
          statsMap[item.difficulty] = item.count;
        });

        const formattedStats = [
          { difficulty: "Easy", count: statsMap.Easy || 0 },
          { difficulty: "Medium", count: statsMap.Medium || 0 },
          { difficulty: "Hard", count: statsMap.Hard || 0 }
        ];

        setLeetcodeStats(formattedStats);
      } else {
        throw new Error("Invalid response structure");
      }

    } catch (err) {
      console.error("❌ Error fetching LeetCode stats:", err);
      setError("Failed to load LeetCode data. Please check your username.");
      
      // Fallback to external API if backend fails
      try {
        console.log("Trying fallback API...");
        const fallbackResponse = await fetch(`https://leetcode-stats-api.herokuapp.com/${username}`);
        if (fallbackResponse.ok) {
          const fallbackResult = await fallbackResponse.json();
          const rawStats = [
            { difficulty: "Easy", count: fallbackResult.easySolved || 0 },
            { difficulty: "Medium", count: fallbackResult.mediumSolved || 0 },
            { difficulty: "Hard", count: fallbackResult.hardSolved || 0 }
          ];
          setLeetcodeStats(rawStats);
          setError(null); // Clear error if fallback works
          console.log("✅ Fallback API worked");
        }
      } catch (fallbackErr) {
        console.error("❌ Fallback API also failed:", fallbackErr);
      }
    }
  };

  const handleSaveHandles = async () => {
    if (!leetcodeHandle || !gfgHandle) {
      alert("Both handles are required!");
      return;
    }

    if (!user) {
      alert("User not authenticated!");
      return;
    }

    try {
      await setDoc(doc(db, "users", user.uid), {
        leetcode: leetcodeHandle,
        gfg: gfgHandle,
        updatedAt: new Date().toISOString()
      }, { merge: true }); // Use merge to update existing document

      alert("Handles saved successfully!");
    } catch (error) {
      console.error("Error saving handles:", error);
      alert("Failed to save handles.");
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      const firebaseToken = localStorage.getItem("firebase-token");
      
      // If user logged in with Firebase, sign out from Firebase
      if (firebaseToken && auth.currentUser) {
        console.log("Logging out Firebase user");
        await signOut(auth);
        localStorage.removeItem("firebase-token");
      }
      
      // If user logged in with token, just clear the token
      if (token) {
        console.log("Logging out token user");
        localStorage.removeItem("token");
      }
      
      // Clear all auth-related data
      setUser(null);
      setLeetcodeHandle("");
      setGfgHandle("");
      setLeetcodeStats([]);
      
      navigate("/login");
    } catch (error) {
      console.error("Error during logout:", error);
      // Force logout even if there's an error
      localStorage.removeItem("token");
      localStorage.removeItem("firebase-token");
      setUser(null);
      navigate("/login");
    }
  };

  const refreshToken = async () => {
    if (user) {
      try {
        const token = await user.getIdToken(true); // Force refresh
        localStorage.setItem("token", token);
      } catch (error) {
        console.error("Error refreshing token:", error);
      }
    }
  };

  // Auto-refresh token every 50 minutes (Firebase tokens expire in 1 hour)
  useEffect(() => {
    if (user) {
      const interval = setInterval(refreshToken, 50 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-4xl">
        {/* User Profile Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 text-center">
          {user.photoURL && (
            <img 
              src={user.photoURL} 
              alt="Profile" 
              className="w-20 h-20 rounded-full shadow-lg mx-auto mb-4" 
              // onError={(e) => {
              //   e.target.src = '/default-avatar.png'; // Fallback image
              // }}
            />
          )}
          <h1 className="text-3xl font-bold text-blue-600 mb-2">
            Welcome, {user.displayName || 'User'}!
          </h1>
          <p className="text-gray-600">{user.email}</p>
        </div>

        {/* Handles Input Section */}
        {(!leetcodeHandle || !gfgHandle) && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6 text-center text-gray-700">
              Enter Your Coding Handles
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-medium text-sm text-gray-700">
                  LeetCode Username
                </label>
                <input
                  type="text"
                  value={leetcodeHandle}
                  onChange={(e) => setLeetcodeHandle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. tarunjain123"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm text-gray-700">
                  GFG Username
                </label>
                <input
                  type="text"
                  value={gfgHandle}
                  onChange={(e) => setGfgHandle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. tarun_jain"
                />
              </div>
            </div>

            <button
              onClick={handleSaveHandles}
              className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
            >
              Save Handles
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-center">{error}</p>
          </div>
        )}

        {/* LeetCode Stats Section */}
        {leetcodeStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
              LeetCode Statistics
            </h2>
            
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {leetcodeStats.map((stat, index) => (
                <div key={stat.difficulty} className="text-center">
                  <div 
                    className="text-2xl font-bold"
                    style={{ color: COLORS[index] }}
                  >
                    {stat.count}
                  </div>
                  <div className="text-gray-600 text-sm">{stat.difficulty}</div>
                </div>
              ))}
            </div>

            {/* Pie Chart */}
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={leetcodeStats}
                  dataKey="count"
                  nameKey="difficulty"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ difficulty, count, percent }) => 
                    `${difficulty}: ${count} (${(percent * 100).toFixed(1)}%)`
                  }
                >
                  {leetcodeStats.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {leetcodeHandle && (
            <button
              onClick={() => fetchLeetCodeStats(leetcodeHandle)}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium"
            >
              Refresh Stats
            </button>
          )}
          
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors duration-200 font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;