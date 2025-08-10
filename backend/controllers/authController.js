const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'; // unify expiry

if (!JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set. Authentication will be insecure.');
}

const registerUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'All fields are required' });

    // basic validation
    if (typeof username !== 'string' || username.length < 3)
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    if (typeof password !== 'string' || password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    // check existing user
    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, password: hashedPassword });

    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    // Option A: return token in JSON (frontend stores it)
    return res.status(201).json({
      user: { id: newUser._id, username: newUser.username },
      token,
    });

    // Option B (safer): set httpOnly cookie instead of returning token in body
    // res.cookie('token', token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'strict',
    //   maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    // });
    // return res.status(201).json({ user: { id: newUser._id, username: newUser.username } });

  } catch (err) {
    // handle duplicate key error (race condition)
    if (err.code === 11000) return res.status(409).json({ message: 'Username already taken' });

    console.error('Registration Error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'All fields are required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    // Return same shape as register
    return res.status(200).json({
      user: { id: user._id, username: user.username },
      token,
    });

    // If using cookies, set cookie and return user only:
    // res.cookie('token', token, { ... });
    // return res.status(200).json({ user: { id: user._id, username: user.username } });

  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ message: 'Server Error' });
  }
};


// NEW: Get user profile
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// NEW: Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const { leetcode, gfg, profilePicture } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { 
        leetcode: leetcode || '',
        gfg: gfg || '',
        profilePicture: profilePicture || ''
      },
      { 
        new: true,
        select: '-password'
      }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { registerUser, loginUser, getUserProfile, updateUserProfile };