// background.js (service worker, type: module) – centralny silnik SQL
importScripts('sql-wasm.js'); // wprowadza globalne initSqlJs

let db; // cached instance

async function loadDb() {
    if (db) return db;
    const SQL = await initSqlJs({ locateFile: f => 'sql-wasm.wasm' });
    const root = await navigator.storage.getDirectory();
    try {
        const dbHandle = await root.getFileHandle('db.sqlite');
        const file = await dbHandle.getFile();
        db = new SQL.Database(new Uint8Array(await file.arrayBuffer()), { filename: true });
        return db;
    } catch (err) {
        console.warn('DB not ready:', err);
        throw new Error('Baza niezaimportowana.');
    }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'sql') return; // nie nasza wiadomość
    loadDb().then(database => {
        try {
            const [res] = database.exec(msg.query);
            sendResponse({ ok: true, res });
        } catch (e) {
            sendResponse({ ok: false, error: e.message });
        }
    }).catch(e => sendResponse({ ok: false, error: e.message }));
    return true; // keep channel open (async response)
});