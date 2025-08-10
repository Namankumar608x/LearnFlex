const jwt = require('jsonwebtoken');

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // will contain { id: ..., iat: ..., exp: ... }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    console.error("JWT verification failed:", error.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

module.exports = protect;
