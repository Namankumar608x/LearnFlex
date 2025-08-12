const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (add this to your server.js if not already done)
// const serviceAccount = require('./path/to/your/firebase-service-account-key.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// });

const protect = (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in environment variables.");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(' ')[1];

    // Try JWT first (your backend tokens)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // will contain { id: ..., iat: ..., exp: ... }
      req.authType = 'jwt';
      return next();
    } catch (jwtError) {
      // If JWT fails, try Firebase token
      console.log('JWT verification failed, trying Firebase token...');
      
      // Verify Firebase ID token
      admin.auth().verifyIdToken(token)
        .then((decodedToken) => {
          req.user = { 
            id: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name,
            firebase: true
          };
          req.authType = 'firebase';
          next();
        })
        .catch((firebaseError) => {
          console.error("Both JWT and Firebase token verification failed:", {
            jwt: jwtError.message,
            firebase: firebaseError.message
          });
          
          if (jwtError.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'JWT token expired' });
          }
          
          return res.status(401).json({ 
            message: 'Unauthorized: Invalid token',
            details: process.env.NODE_ENV === 'development' ? 
              `JWT: ${jwtError.message}, Firebase: ${firebaseError.message}` : 
              undefined
          });
        });
    }

  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(500).json({ message: 'Authentication service error' });
  }
};

// Optional: Create a simpler version that only handles JWT (if you prefer)
const protectJWTOnly = (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in environment variables.");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // will contain { id: ..., iat: ..., exp: ... }
    req.authType = 'jwt';
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token format' });
    }
    
    console.error("JWT verification failed:", error.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = protect;
// Export both if you want options:
// module.exports = { protect, protectJWTOnly };