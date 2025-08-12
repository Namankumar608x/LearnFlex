import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { Link, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import axios from "axios";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Search, Video } from "lucide-react";

const COLORS = ["#0088FE", "#00C49F", "#FF8042", "#FFBB28", "#AA00FF"];

function Dashboard() {
  const [user, setUser] = useState(null);
  const [leetcodeHandle, setLeetcodeHandle] = useState("");
  const [gfgHandle, setGfgHandle] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [leetcodeStats, setLeetcodeStats] = useState([]);
  const [gfgStats, setGfgStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gfgError, setGfgError] = useState("");
  const [handlesSaved, setHandlesSaved] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const token = localStorage.getItem("token");
    if (token) {
      const tokenUser = {
        uid: "token-user",
        email: "token-authenticated-user",
        displayName: "Token User",
        photoURL: null,
      };
      setUser(tokenUser);
      
      // Fetch user profile data from MongoDB for JWT users
      fetchUserProfile();
      
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!mounted) return;

      if (!currentUser) {
        setLoading(false);
        navigate("/login");
        return;
      }

      try {
        const firebaseToken = await currentUser.getIdToken();
        localStorage.setItem("firebase-token", firebaseToken);
        setUser(currentUser);

        const userRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setLeetcodeHandle(data.leetcode || "");
          setGfgHandle(data.gfg || "");
          if (data.leetcode && data.gfg) {
            setHandlesSaved(true);
          }
        }
      } catch (error) {
        console.error("Error with Firebase authentication:", error);
        navigate("/login");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [navigate]);

  // Function to fetch user profile from MongoDB using axios
  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get('http://localhost:5000/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const userData = response.data;
      setLeetcodeHandle(userData.leetcode || "");
      setGfgHandle(userData.gfg || "");
      setProfilePicture(userData.profilePicture || "");
      
      if (userData.leetcode && userData.gfg) {
        setHandlesSaved(true);
      }
    } catch (error) {
      console.error('Error fetching profile:', error.response?.data?.message || error.message);
    }
  };

  useEffect(() => {
    if (leetcodeHandle) {
      fetchLeetCodeStats(leetcodeHandle);
    }
    if (gfgHandle) {
      fetchGfgStats(gfgHandle);
    }
  }, [leetcodeHandle, gfgHandle]);

  const fetchLeetCodeStats = async (username) => {
    try {
      const response = await fetch(
        `https://leetcode-stats-api.herokuapp.com/${username}`
      );
      if (!response.ok) throw new Error("Failed to fetch");

      const result = await response.json();

      const rawStats = [
        { difficulty: "Easy", count: result.easySolved },
        { difficulty: "Medium", count: result.mediumSolved },
        { difficulty: "Hard", count: result.hardSolved },
      ];

      setLeetcodeStats(rawStats);
    } catch (err) {
      console.error("❌ Error fetching LeetCode stats:", err);
      setError("Failed to load LeetCode data.");
    }
  };

  const fetchGfgStats = async (username) => {
    try {
      const url = `https://geeks-for-geeks-stats-api.vercel.app/?raw=y&userName=${username}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch GFG stats.");

      const data = await response.json();

      const statsArr = [
        { difficulty: "School", count: data.School },
        { difficulty: "Basic", count: data.Basic },
        { difficulty: "Easy", count: data.Easy },
        { difficulty: "Medium", count: data.Medium },
        { difficulty: "Hard", count: data.Hard },
      ];

      setGfgStats(statsArr);
      setGfgError("");
    } catch (err) {
      console.error("❌ Error fetching GFG stats:", err);
      setGfgError("Failed to load GFG data.");
    }
  };

  // Handle clicking on profile picture to upload
  const handleProfilePictureClick = () => {
    document.getElementById('profilePictureInput').click();
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveHandles = async () => {
    if (!leetcodeHandle || !gfgHandle) {
      alert("Both handles are required!");
      return;
    }

    const token = localStorage.getItem("token");

    // If JWT token exists, save to MongoDB using axios
    if (token) {
      try {
        const response = await axios.put('http://localhost:5000/api/auth/profile', {
          leetcode: leetcodeHandle,
          gfg: gfgHandle,
          profilePicture: profilePicture
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        setHandlesSaved(true);
        alert("Profile saved successfully!");
        return; // Exit early for JWT users
      } catch (error) {
        console.error("Error saving profile:", error.response?.data?.message || error.message);
        alert("Failed to save profile.");
        return;
      }
    }

    // Firebase save (existing code) - only runs if no JWT token
    try {
      await setDoc(doc(db, "users", user.uid), {
        leetcode: leetcodeHandle,
        gfg: gfgHandle,
      });
      setHandlesSaved(true);
      alert("Handles saved successfully!");
    } catch (error) {
      console.error("Error saving handles:", error);
      alert("Failed to save handles.");
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem("token");
    
    // If JWT user, just clear token and redirect
    if (token) {
      localStorage.removeItem("token");
      navigate("/login");
      return;
    }
    
    // Firebase logout
    await signOut(auth);
    navigate("/login");
  };

  // Navigation function for YouTube Search
  const handleNavigateToSearch = () => {
    navigate("/search");
  };

  if (loading || !user) {
    return (
      <p className="text-center mt-20 text-gray-500">Loading dashboard...</p>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      {/* Clickable Profile Picture */}
      <div className="relative cursor-pointer group" onClick={handleProfilePictureClick}>
        <img
          src={profilePicture || user.photoURL || "https://via.placeholder.com/80"}
          alt="Profile"
          className="w-20 h-20 rounded-full shadow mb-4 object-cover group-hover:opacity-75 transition-opacity"
        />
        {/* Upload overlay icon */}
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-full transition-all mb-4">
          <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        
        {/* Hidden file input */}
        <input
          id="profilePictureInput"
          type="file"
          accept="image/*"
          onChange={handleProfilePictureUpload}
          className="hidden"
        />
      </div>

      <h1 className="text-2xl font-bold text-blue-600">
        Welcome, {user.displayName}!
      </h1>
      <p className="text-gray-600 mt-2">{user.email}</p>

      {/* YouTube Search Navigation Button */}
      <div className="mt-6">
        <button
          onClick={handleNavigateToSearch}
          className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium shadow-lg"
        >
          <Video className="h-5 w-5" />
          <Search className="h-5 w-5" />
          Search YouTube Videos
        </button>
      </div>

      {/* Input form stays visible until handles are saved */}
      {!handlesSaved && (
        <div className="mt-8 w-full max-w-md bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-4 text-center text-gray-700">
            Enter Your Coding Handles
          </h2>
          
          <label className="block mb-2 font-medium text-sm">
            LeetCode Username
          </label>
          <input
            type="text"
            value={leetcodeHandle}
            onChange={(e) => setLeetcodeHandle(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
            placeholder="e.g. tarunjain123"
          />
          <label className="block mb-2 font-medium text-sm">
            GFG Username
          </label>
          <input
            type="text"
            value={gfgHandle}
            onChange={(e) => setGfgHandle(e.target.value)}
            className="w-full p-2 mb-4 border rounded"
            placeholder="e.g. tarun_jain"
          />
          <button
            onClick={handleSaveHandles}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            Save handles
          </button>
        </div>
      )}

      {error && <p className="text-red-500 mt-4">{error}</p>}
      {gfgError && <p className="text-red-500 mt-4">{gfgError}</p>}

      {leetcodeStats.length > 0 && (
        <div className="mt-10 w-full max-w-xl bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-4">LeetCode Stats</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={leetcodeStats}
                dataKey="count"
                nameKey="difficulty"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {leetcodeStats.map((entry, index) => (
                  <Cell
                    key={index}
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

      {gfgStats.length > 0 && (
        <div className="mt-10 w-full max-w-xl bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-semibold mb-4">GFG Stats</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={gfgStats}
                dataKey="count"
                nameKey="difficulty"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {gfgStats.map((entry, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="mt-10 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
      >
        Logout
      </button>
    </div>
  );
}

export default Dashboard;