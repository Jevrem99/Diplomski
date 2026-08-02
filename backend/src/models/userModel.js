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
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return null; // Sprečava Prisma grešku ako id nije broj

    return await prisma.user.findUnique({
        where: { id: numericId },
        select: { id: true, username: true, email: true, uloga: true, password: true }
    });
};

const getUserByUsername = async (identifier) => {
    return await prisma.user.findFirst({
        where: {
            OR: [
                { username: identifier },
                { email: identifier }
            ]
        }
    });
};



const registerUser = async (username, email, password, uloga = 'asistent') => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // 1. Kreiramo korisnički nalog
    const newUser = await prisma.user.create({
        data: {
            username: username,
            email: email,
            password: hashedPassword,
            uloga: uloga
        },
        select: { id: true, username: true, email: true, uloga: true }
    });

    // 2. Proveravamo da li već postoji profil saradnika/profesora sa tim mejlom
    const postojeciProfesor = await prisma.profesor.findFirst({
        where: { email: email }
    });

    // 3. Ako ne postoji, kreiramo ga automatski
    if (!postojeciProfesor) {
        await prisma.profesor.create({
            data: {
                ime: username,
                prezime: '',
                email: email,
                is_saradnik: uloga === 'asistent'
            }
        });
    }
    
    return newUser;
};

const updateUser = async (id, username, email, password, uloga) => {
    let dataToUpdate = {
        username: username,
        email: email,
        uloga: uloga
    };

    // Ažurira lozinku samo ako je poslata nova vrednost
    if (password && password.trim() !== '') {
        const saltRounds = 10;
        dataToUpdate.password = await bcrypt.hash(password, saltRounds);
    }

    const updatedUser = await prisma.user.update({
        where: { id: parseInt(id) },
        data: dataToUpdate,
        select: { id: true, username: true, email: true, uloga: true }
    });
    return updatedUser;
};

const deleteUser = async (id) => {
    const deletedUser = await prisma.user.delete({
        where: { id: parseInt(id) },
        select: { id: true, username: true, email: true }
    });
    
    return deletedUser;
}

// Validira lozinku za uneti username ili email
const validatePassword = async (identifier, password) => {
    const user = await getUserByUsername(identifier);
    if (!user) return false;

    return await bcrypt.compare(password, user.password);
};

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
};