// Izvršava asinhronu funkciju nad listom, najviše `limit` poziva istovremeno; čuva redosled rezultata.
async function mapLimit(items, limit, fn) {
    const rezultati = new Array(items.length);
    let sledeci = 0;

    const radnik = async () => {
        while (sledeci < items.length) {
            const idx = sledeci++;
            rezultati[idx] = await fn(items[idx], idx);
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, radnik));
    return rezultati;
}

module.exports = { mapLimit };
