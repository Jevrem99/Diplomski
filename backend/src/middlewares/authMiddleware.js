const jwt = require('jsonwebtoken');
const config = require('../config/config');

const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Niste autorizovani, token nedostaje' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, config.secret);     
        req.user = decoded;           
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token nije validan ili je istekao' });
    }
}

const restrictToAdmin = (req, res, next) => {
    if (req.user.uloga !== 'admin') {
        return res.status(403).json({ message: "Nemate administratorska prava za ovu akciju!" });
    }
    next();
}

module.exports = { protect, restrictToAdmin };