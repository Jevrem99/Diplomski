const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const prisma = require('../db/prisma');

const getAllUsers = async () => {
    return await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            email: true
        }
    });
}

const getUserById = async (id) => {
    return await prisma.user.findUnique({
        where: { id: Number(id) },
        select: {
            id: true,
            username: true,
            email: true
        }
    });
}

const getUserByUsername = async (username) => {
    return await prisma.user.findUnique({
        where: { username: username },
        select: {
            id: true,
            username: true,
            email: true
        }
    });
}

const registerUser = async (username, email, password) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    return await prisma.user.create({
        data: {
            username: username,
            email: email,
            password: hashedPassword
        },
        select: {
            id: true,
            username: true,
            email: true
        }
    });
}

const updateUser = async (id, username, email, password) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    return await prisma.user.update({
        where: { id: Number(id) },
        data: {
            username: username,
            email: email,
            password: hashedPassword
        },
        select: {
            id: true,
            username: true,
            email: true
        }
    });
}

const deleteUser = async (id) => {
    return await prisma.user.delete({
        where: { id: Number(id) },
        select: {
            id: true,
            username: true,
            email: true
        }
    });
}

const validatePassword = async (username, password) => {
    const user = await prisma.user.findFirst({
        where: { username: username }
    });

    const hashedPassword = user ? user.password : "$2b$10$fakehashfakehashfakehashfakehashfakehashfakehashf";
    const isValid = await bcrypt.compare(password, hashedPassword);

    if (!user) {
        return false;
    }

    return isValid;
}

const generateJwtToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email
        },
        config.secret,
        { expiresIn: '7d' }
    );
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
};