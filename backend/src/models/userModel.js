require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Kreiramo sirovu konekciju koristeći tvoj .env fajl
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Ubacujemo tu konekciju u Prisma adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

const getAllUsers = async () => {
    return await prisma.user.findMany({
        select: { id: true, username: true, email: true, uloga: true }
    });
}

const getUserById = async (id) => {
    return await prisma.user.findUnique({
        where: { id: parseInt(id) },
        select: { id: true, username: true, email: true, uloga: true, password: true }
    });
}

const getUserByUsername = async (username) => {
    return await prisma.user.findUnique({
        where: { username: username }
    });
}

const registerUser = async (username, email, password, uloga = 'asistent') => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const newUser = await prisma.user.create({
        data: {
            username: username,
            email: email,
            password: hashedPassword,
            uloga: uloga
        },
        select: { id: true, username: true, email: true, uloga: true }
    });
    
    return newUser;
}

const updateUser = async (id, username, email, password, uloga) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const updatedUser = await prisma.user.update({
        where: { id: parseInt(id) },
        data: {
            username: username,
            email: email,
            password: hashedPassword,
            uloga: uloga
        },
        select: { id: true, username: true, email: true, uloga: true }
    });

    return updatedUser;
}

const deleteUser = async (id) => {
    const deletedUser = await prisma.user.delete({
        where: { id: parseInt(id) },
        select: { id: true, username: true, email: true }
    });
    
    return deletedUser;
}

const validatePassword = async (username, password) => {
    const user = await prisma.user.findUnique({
        where: { username: username }
    });
    
    const hashedPassword = user 
        ? user.password 
        : "$2b$10$fakehashfakehashfakehashfakehashfakehashfakehashf";
    
    const isValid = await bcrypt.compare(password, hashedPassword);
    if (!user) {
        return false;
    }
    return isValid;
}

const generateJwtToken = (user) => {
    var expire = new Date();
    expire.setDate(expire.getDate() + 7);
    
    return jwt.sign({
        id: user.id,
        username: user.username,
        email: user.email,
        uloga: user.uloga, 
        exp: parseInt(expire.getTime() / 1000),
    }, config.secret)
}

module.exports = {
    getAllUsers,
    getUserById,
    getUserByUsername,
    registerUser,
    updateUser,
    deleteUser,
    validatePassword,
    generateJwtToken
}