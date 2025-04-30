// options.js – import bazy SQLite (100 MB+) do Origin Private File System
// Wersja bez modułów ES, korzysta z globalnego initSqlJs z sql-wasm.js (nie jest tu potrzebna)

const pickBtn = document.getElementById('pick');
const status  = document.getElementById('status');

pickBtn.addEventListener('click', async () => {
    // 1️⃣ Wybór pliku SQLite z dysku użytkownika
    const [handle] = await window.showOpenFilePicker({
        types: [
            {
                description: 'SQLite',
                accept: { 'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'] }
            }
        ]
    });
    if (!handle) return;

    const file = await handle.getFile();

    // 2️⃣ Kopiowanie pliku do Origin Private File System (OPFS)
    //    – przekazujemy cały Blob, bez kombinowania ze strumieniem
    const root = await navigator.storage.getDirectory();
    const dbHandle = await root.getFileHandle('db.sqlite', { create: true });
    const writable = await dbHandle.createWritable();
    await writable.write(file);   // <-- kluczowa zmiana (Blob zamiast streamu)
    await writable.close();

    // 3️⃣ Flaga w chrome.storage – baza gotowa do użycia w popupie
    await chrome.storage.local.set({ dbReady: true });

    status.textContent =
        `Zaimportowano ${file.name} – ${(file.size / 1048576).toFixed(1)} MB.`;
});