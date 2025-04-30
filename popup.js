(async () => {
    const queryEl  = document.getElementById('query');
    const runBtn   = document.getElementById('runBtn');
    const resultEl = document.getElementById('result');
    const msgEl    = document.getElementById('msg');

    const { dbReady } = await chrome.storage.local.get('dbReady');
    if (!dbReady) {
        msgEl.textContent = 'Najpierw zaimportuj bazę w ustawieniach rozszerzenia.';
        runBtn.disabled = true;
        return;
    }

    // 1️⃣ Inicjalizacja sql.js – globalna initSqlJs() dostępna po załadowaniu pliku
    const SQL = await initSqlJs({ locateFile: f => 'sql-wasm.wasm' });

    // 2️⃣ Otwórz plik bazy z OPFS
    const root = await navigator.storage.getDirectory();
    const dbHandle = await root.getFileHandle('db.sqlite');
    const file = await dbHandle.getFile();
    const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()), { filename: true });

    runBtn.addEventListener('click', () => {
        const sql = queryEl.value.trim();
        if (!sql) return;

        try {
            const [res] = db.exec(sql);
            if (!res) {
                resultEl.innerHTML = '<em>Zapytanie nie zwróciło danych.</em>';
                return;
            }
            // render
            const html = `
        <table>
          <thead><tr>${res.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>
            ${res.values.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>`;
            resultEl.innerHTML = html;
            msgEl.textContent = '';
        } catch (e) {
            msgEl.textContent = e.message;
            resultEl.innerHTML = '';
        }
    });
})();