function runSQL(query) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({type: 'sql', query}, resp => {
            if (!resp || !resp.ok) return reject(resp?.error || 'Brak odpowiedzi');
            resolve(resp.res); // { columns: [...], values: [...] }
        });
    });
}

function mapSQLResult(result) {
    const { columns, values } = result;
    return values.map(row => {
        const obj = {};
        columns.forEach((colName, index) => {
            obj[colName] = row[index];
        });
        return obj;
    });
}