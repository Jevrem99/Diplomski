const axios = require('axios');
const cheerio = require('cheerio');
const prisma = require('../db/prisma');

const syncZauzetostSala = async () => {
    // 1. Brišemo staru redovnu nastavu iz baze
    await prisma.redovnaNastava.deleteMany({});
    let ukupnoSacuvano = 0;

    // 2. Generišemo sve radne dane za letnji semestar (od 01.03.2026. do 31.05.2026.)
    const radnaNedelja = [];
    const startDate = new Date(2026, 2, 1);  // 1. Mart 2026.
    const endDate = new Date(2026, 4, 31);   // 31. Maj 2026.

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        // Uzimamo samo radne dane (Ponedeljak=1 do Subota=6)
        if (dayOfWeek !== 0) { 
            radnaNedelja.push({
                d: d.getDate(),
                m: d.getMonth() + 1,
                y: d.getFullYear(),
                dan_u_nedelji: dayOfWeek
            });
        }
    }

    console.log(`Započinjem preuzimanje rasporeda za ${radnaNedelja.length} radnih dana semestra...`);

    // 3. Prolazimo kroz svaki dan i šaljemo POST zahtev na IMI server
    for (const dan of radnaNedelja) {
        try {
            const response = await axios.post(
                'https://imi.pmf.kg.ac.rs/cp/rs/day.php',
                `day=${dan.d}&month=${dan.m}&year=${dan.y}`,
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            const html = response.data.result;
            if (!html) continue;

            const $ = cheerio.load(html);

            // Sakupljamo nazive sala iz drugog <tr> reda
            const saleNazivi = [];
            $('table > tbody > tr:nth-child(2) > td').each((i, td) => {
                if (i > 0) {
                    const txt = $(td).text().trim();
                    if (txt) saleNazivi.push(txt);
                }
            });

            // Uzimamo kolone sa časovima za svaku salu iz trećeg <tr> reda
            const kolone = $('table > tbody > tr:nth-child(3) > td[rowspan="17"]').toArray();

            for (let i = 0; i < kolone.length; i++) {
                const salaNaziv = saleNazivi[i];
                if (!salaNaziv) continue;

                // Bezbedno proveravamo/kreiramo salu u bazi
                let dbSala = await prisma.sala.findFirst({ where: { naziv: salaNaziv } });
                if (!dbSala) {
                    try {
                        dbSala = await prisma.sala.create({ data: { naziv: salaNaziv } });
                    } catch (e) {
                        dbSala = await prisma.sala.findFirst({ where: { naziv: salaNaziv } });
                    }
                }

                if (!dbSala) continue;

                // Čupamo sve <a> tagove unutar kolone te sale
                const aTagovi = $(kolone[i]).find('a').toArray();

                for (const aTag of aTagovi) {
                    const vremeTekst = $(aTag).find('small').text().trim();
                    if (!vremeTekst || !vremeTekst.includes('-')) continue;

                    let predmetNaziv = $(aTag).text().replace(vremeTekst, '').trim();
                    predmetNaziv = predmetNaziv.replace(/^"/, '').replace(/"$/, '').trim();

                    const [vreme_pocetka, vreme_kraja] = vremeTekst.split('-');
                    const tacanDatum = new Date(dan.y, dan.m - 1, dan.d);

                    await prisma.redovnaNastava.create({
                        data: {
                            sala_id: dbSala.id,
                            datum: tacanDatum,
                            vreme_pocetka: vreme_pocetka.trim(),
                            vreme_kraja: vreme_kraja.trim(),
                            predmet: predmetNaziv
                        }
                    });
                    ukupnoSacuvano++;
                }
            }

            console.log(`Uspešno preuzet raspored za ${dan.d}.${dan.m}.${dan.y}.`);

        } catch (error) {
            console.error(`Greška za datum ${dan.d}.${dan.m}.${dan.y}:`, error.message);
        }
    }

    return { 
        success: true, 
        poruka: `Uspešno sinhronizovano ${ukupnoSacuvano} termina redovne nastave sa IMI servera za ceo semestar!` 
    };
};

module.exports = { syncZauzetostSala };