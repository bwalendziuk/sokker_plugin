importScripts('sql-wasm.js');

let db;

/**
 * Ładuje bazę danych SQLite z pamięci przeglądarki.
 * @returns {Promise<SQL.Database>} Obiekt bazy danych.
 */
async function loadDb() {
    if (db) return db;
    // Inicjalizacja SQL.js
    const SQL = await initSqlJs({ locateFile: f => 'sql-wasm.wasm' });

    // Dostęp do pamięci przeglądarki (File System Access API)
    const root = await navigator.storage.getDirectory();
    try {
        const dbHandle = await root.getFileHandle('db.sqlite');
        const file = await dbHandle.getFile();

        // Tworzenie obiektu bazy danych z zawartości pliku
        db = new SQL.Database(new Uint8Array(await file.arrayBuffer()), { filename: true });
        return db;
    } catch (err) {
        console.warn('DB not ready:', err);
        // Ważne: rzuć wyjątek, aby catch w listenerze go obsłużył.
        throw new Error('Baza niezaimportowana lub niedostępna.');
    }
}

// Główny listener wiadomości z Content Scripts lub Popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // ==========================
    // 1) calcTalent — SkTables (Pobiera HTML i zwraca do content.js)
    // ==========================
    if (msg.action === "calcTalent") {
        console.log("CalcTalent - Fetching HTML by ID");

        (async () => {
            try {
                const playerId = msg.id;
                if (!playerId) {
                    throw new Error("Missing player ID in message.");
                }

                const url = `https://sktables.org/academy/talent/ID/${playerId}`;
                console.log("[BG] Fetching URL:", url);

                const res = await fetch(url, {
                    method: "GET",
                    headers: {
                        "accept": "text/html"
                    }
                });

                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const html = await res.text();

                // ZWRACAMY CZYSTY HTML do Content Script
                sendResponse({
                    ok: true,
                    html: html
                });

            } catch (e) {
                console.error("[BG] ERROR:", e);
                sendResponse({ ok: false, error: e.toString() });
            }
        })();

        return true; // KEEP PORT OPEN
    }

    if (msg.action === "getMyTeamValue") {
        console.log("getMyTeamValue - Fetching HTML");

        (async () => {
            try {
                const url = 'https://www.sktables.org/myteam/value';
                const res = await fetch(url, {
                    method: "GET",
                    headers: { "accept": "text/html" }
                });

                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const html = await res.text();

                sendResponse({
                    ok: true,
                    html: html
                });

            } catch (e) {
                console.error("[BG] getMyTeamValue ERROR:", e);
                sendResponse({ ok: false, error: e.toString() });
            }
        })();

        return true; // KEEP PORT OPEN
    }

    // ==========================
    // 2) SQL queries
    // ==========================
    if (msg.type === "sql") {
        loadDb().then(database => {
            try {
                const [res] = database.exec(msg.query);
                sendResponse({ ok: true, res });
            } catch (err) {
                sendResponse({ ok: false, error: err.message });
            }
        }).catch(e => sendResponse({ ok: false, error: e.message }));

        return true; // KEEP PORT OPEN
    }

    // ==========================
    // 3) DEFAULT — MUSI być!
    // ==========================
    console.warn("UNKNOWN MESSAGE:", msg);

    sendResponse({
        ok: false,
        error: "Unknown message type",
        msg
    });

    return false; // close port
});