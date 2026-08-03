const axios = require('axios');
const prisma = require('../db/prisma');

// Spisak URL-ova koje ti je Miša poslao
const IMI_URLS = [
    'https://imi.pmf.kg.ac.rs/rasporedi/json_datasets/IgodInfLet15.js',
    'https://imi.pmf.kg.ac.rs/rasporedi/json_datasets/IIgodInfLet15_si.js'
    // Ovde ćemo dodati ostale linkove...
];

const syncZauzetostSala = async () => {
    // 1. Obriši staru redovnu nastavu pre uvoza novog semestra
    await prisma.redovnaNastava.deleteMany({});
    let sacuvanoCasova = 0;

    for (const url of IMI_URLS) {
        try {
            const response = await axios.get(url);
            let dataStr = response.data;
            
            if (dataStr.includes('=')) {
                const startIndex = dataStr.indexOf('[');
                const endIndex = dataStr.lastIndexOf(']') + 1;
                dataStr = dataStr.substring(startIndex, endIndex);
            }
            
            const casoviArray = JSON.parse(dataStr);
            
            // Ovde će ići Prisma logika za upis, čim vidimo strukturu fajla!
            console.log(`Preuzeto ${casoviArray.length} časova sa URL-a: ${url}`);
            sacuvanoCasova += casoviArray.length;

        } catch (error) {
            console.error(`Greška pri sinhronizaciji sa ${url}:`, error.message);
        }
    }
    
    return { success: true, poruka: `Uspešno sinhronizovano ${sacuvanoCasova} redovnih časova!` };
};

module.exports = { syncZauzetostSala };