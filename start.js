// Pokreće back end i front end jednom komandom:  npm start   (iz glavnog foldera projekta)
// Ctrl+C gasi oba. Portovi se menjaju sa: PORT (back end, podrazumevano 5000) i FRONT_PORT (front end, 4200).
const { spawn } = require('child_process');
const path = require('path');

const BOJE = { backend: '\x1b[36m', frontend: '\x1b[35m', reset: '\x1b[0m' };
const procesi = [];
let gasenje = false;

const pokreni = (ime, folder, komanda, args, env = {}) => {
    const dete = spawn(komanda, args, {
        cwd: path.join(__dirname, folder),
        shell: true,
        env: { ...process.env, ...env },
    });
    const ispis = (tok) => (podaci) => {
        String(podaci).split(/\r?\n/).filter((l) => l.trim() !== '').forEach((l) => tok.write(`${BOJE[ime]}[${ime}]${BOJE.reset} ${l}\n`));
    };
    dete.stdout.on('data', ispis(process.stdout));
    dete.stderr.on('data', ispis(process.stderr));
    dete.on('exit', (kod) => {
        if (!gasenje) {
            console.error(`[${ime}] se zaustavio (kod ${kod}). Gasim i drugi proces.`);
            ugasi(kod || 1);
        }
    });
    procesi.push(dete);
};

const ugasi = (kod = 0) => {
    if (gasenje) return;
    gasenje = true;
    procesi.forEach((p) => {
        try {
            if (process.platform === 'win32') spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'], { shell: true });
            else p.kill('SIGTERM');
        } catch { /* već ugašen */ }
    });
    setTimeout(() => process.exit(kod), 800);
};

process.on('SIGINT', () => ugasi(0));
process.on('SIGTERM', () => ugasi(0));

const frontPort = process.env.FRONT_PORT || '4200';
console.log(`Pokrećem back end (port ${process.env.PORT || 5000}) i front end (http://localhost:${frontPort}) ...`);
pokreni('backend', 'backend', 'node', ['src/server.js']);
pokreni('frontend', 'frontend', 'npx', ['ng', 'serve', '--port', frontPort]);
