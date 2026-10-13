// Minimalna provera JSON Schema (draft-07) koja pokriva ono što koristi docs/rezervacije-sala.schema.json:
// type (i niz tipova), const, pattern, minimum, minLength, minItems, required, properties,
// additionalProperties:false, items i $ref na #/definitions/...
// Vraća listu grešaka (prazna lista = ispravno). Bez spoljnih paketa.
const tipOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const jeTip = (v, t) => (t === 'number' ? typeof v === 'number' : tipOf(v) === t);

function proveri(sema, vrednost, koren, putanja = '$') {
    const greske = [];
    if (sema.$ref) {
        const kljuc = sema.$ref.replace('#/definitions/', '');
        return proveri(koren.definitions[kljuc], vrednost, koren, putanja);
    }
    if (sema.type) {
        const tipovi = Array.isArray(sema.type) ? sema.type : [sema.type];
        if (!tipovi.some((t) => jeTip(vrednost, t))) return [`${putanja}: tip ${tipOf(vrednost)} nije ${tipovi.join('|')}`];
    }
    if (sema.const !== undefined && vrednost !== sema.const) greske.push(`${putanja}: mora biti ${JSON.stringify(sema.const)}`);
    if (typeof vrednost === 'string') {
        if (sema.pattern && !new RegExp(sema.pattern).test(vrednost)) greske.push(`${putanja}: "${vrednost}" ne odgovara obrascu ${sema.pattern}`);
        if (sema.minLength !== undefined && vrednost.length < sema.minLength) greske.push(`${putanja}: prekratko`);
    }
    if (typeof vrednost === 'number' && sema.minimum !== undefined && vrednost < sema.minimum) greske.push(`${putanja}: manje od ${sema.minimum}`);
    if (Array.isArray(vrednost)) {
        if (sema.minItems !== undefined && vrednost.length < sema.minItems) greske.push(`${putanja}: manje od ${sema.minItems} stavki`);
        if (sema.items) vrednost.forEach((x, i) => greske.push(...proveri(sema.items, x, koren, `${putanja}[${i}]`)));
    }
    if (vrednost && typeof vrednost === 'object' && !Array.isArray(vrednost)) {
        (sema.required || []).forEach((k) => { if (!(k in vrednost)) greske.push(`${putanja}: nedostaje polje "${k}"`); });
        const poznata = sema.properties || {};
        Object.keys(vrednost).forEach((k) => {
            if (poznata[k]) greske.push(...proveri(poznata[k], vrednost[k], koren, `${putanja}.${k}`));
            else if (sema.additionalProperties === false) greske.push(`${putanja}: nepoznato polje "${k}"`);
        });
    }
    return greske;
}

module.exports = { proveriSemu: (sema, vrednost) => proveri(sema, vrednost, sema) };
