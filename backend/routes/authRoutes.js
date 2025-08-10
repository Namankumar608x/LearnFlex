const express=require('express');
const router=express.Router();
const protect = require('../middleware/authmiddleware');
const {registerUser,loginUser}=require("../controllers/authController");

router.post('/Signup',registerUser);

// Login route
router.post('/Login', loginUser);
router.get("/me", protect, (req, res) => {
  res.status(200).json({ user: req.user });
}); 
module.exports = router;