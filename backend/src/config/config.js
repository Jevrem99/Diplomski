require('dotenv').config();

const config = {
    port: process.env.PORT || 5000,
    secret: process.env.JWT_SECRET || "diplomski_rad_privremeni_tajni_kljuc_123!"
};

module.exports = config;