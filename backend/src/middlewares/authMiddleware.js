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
        return res.status(401).json({ message: 'Token nije validan' });
    }
};


const restrictToAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "You don't have a permission to access this resource" });
    }
    next();
};

module.exports = { protect, restrictToAdmin };