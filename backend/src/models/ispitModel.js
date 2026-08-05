const prisma = require('../db/prisma');

const getAllIspiti = async () => {
    return await prisma.ispit.findMany({
        include: {
            predmet: { include: { profesor: true } },
            sala: true,
            // OBAVEZNO: Povlačimo dežurstva i podatke o saradniku
            dezurstva: {
                include: {
                    saradnik: true
                }
            }
        }
    });
};

const getIspitById = async (id) => {
    return await prisma.ispit.findUnique({
        where: { id: Number(id) },
        include: { predmet: true }
    });
};

const createIspit = async (predmet_id, datum, vreme, vreme_kraja, is_ispit = true, sala_id = null, dezurni_ids = []) => {
    return await prisma.ispit.create({
        data: {
            datum: new Date(datum),
            vreme: new Date(`${datum}T${vreme}Z`),
            vreme_kraja: vreme_kraja ? new Date(`${datum}T${vreme_kraja}Z`) : null,
            is_ispit: Boolean(is_ispit),
            predmet: predmet_id ? { connect: { id: Number(predmet_id) } } : undefined,
            sala: sala_id ? { connect: { id: Number(sala_id) } } : undefined,
            // KREIRAMO DEŽURSTVA ODMAH PRI PRVOM UNOSU:
            dezurstva: {
                create: (dezurni_ids || []).map(s_id => ({ saradnik_id: Number(s_id) }))
            }
        }
    });
};

const updateIspit = async (id, predmet_id, datum, vreme, vreme_kraja, is_ispit, sala_id, dezurni_ids = []) => {
    // Provera ID-ja
    const dateStr = new Date(datum).toISOString().split('T')[0];
    const numericId = Number(id);
    if (isNaN(numericId)) {
        throw new Error(`Nevalidan ID ispita: ${id}`);
    }

    // Provera i formatiranje datuma
    if (!datum || isNaN(new Date(datum).getTime())) {
        throw new Error(`Nevalidan datum: ${datum}`);
    }
    const parsedDatum = new Date(datum);

    // Formatiranje vremena
    let parsedVreme = null;
    if (vreme) {
        const cistoVreme = vreme.includes('T') ? vreme.substring(11, 16) : vreme.substring(0, 5);
        const dateStr = parsedDatum.toISOString().split('T')[0];
        parsedVreme = new Date(`${dateStr}T${cistoVreme}:00Z`);
    }

    let parsedVremeKraja = null;
    if (vreme_kraja) {
        const cistoVremeKraja = vreme_kraja.includes('T') ? vreme_kraja.substring(11, 16) : vreme_kraja.substring(0, 5);
        const dateStr = parsedDatum.toISOString().split('T')[0];
        parsedVremeKraja = new Date(`${dateStr}T${cistoVremeKraja}:00Z`);
    }

    return await prisma.ispit.update({
        where: { id: Number(id) },
        data: {
            predmet: { connect: { id: Number(predmet_id) } },
            datum: new Date(dateStr),
            vreme: parsedVreme,
            vreme_kraja: parsedVremeKraja,
            is_ispit: is_ispit,
            sala: sala_id ? { connect: { id: Number(sala_id) } } : { disconnect: true },
            is_published: false,   // Vraća u nacrt
            is_izmenjen: true,     // <--- SADA ĆE PROĆI BEZ GREŠKE jer baza ima ovo polje!
            dezurstva: {
                deleteMany: {},
                create: (dezurni_ids || []).map(dId => ({
                    saradnik_id: Number(dId)
                }))
            }
        },
        include: { predmet: true, sala: true, dezurstva: true }
    });
};
const deleteIspit = async (id) => {
    return await prisma.ispit.delete({
        where: { id: Number(id) }
    });
};

module.exports = {
    getAllIspiti,
    getIspitById,
    createIspit,
    updateIspit,
    deleteIspit
};