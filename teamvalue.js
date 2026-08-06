// content.js — Działa na stronie Sokker (np. /app/squad/...)
// Cel: Wstrzykiwanie estymacji SkTables jako oddzielnego pola "Estymacja" w nagłówku gracza.

// Helper: Pobiera HTML ze SkTables przez background.js
function getMyTeamValueHtml(callback) {
    chrome.runtime.sendMessage(
        { action: "getMyTeamValue" },
        response => callback(response)
    );
}

// Funkcja parsowania DOM SkTables, zwraca zmapowane dane dla wszystkich zawodników
function parseSkTablesHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const data = {};

    // 1. Znajdujemy tabelę z wartościami zawodników
    const tableBody = doc.querySelector('.max-w-10.m-x-auto .sortable.smaller tbody.list');

    if (!tableBody) {
        console.error("Nie znaleziono tabeli wartości zawodników w SkTables HTML.");
        return data;
    }

    const rows = tableBody.querySelectorAll('tr');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');

        if (cells.length >= 7) {
            // A. Pobranie ID Zawodnika (PID)
            const playerLink = cells[0].querySelector('a');
            const pidMatch = playerLink ? playerLink.href.match(/\/myteam\/player\/(\d+)/) : null;
            const playerId = pidMatch ? pidMatch[1] : null;

            if (playerId) {
                // B. Wyodrębnienie TYLKO Estymacji
                const estimCell = cells[3]; // Estim

                const cleanText = (element) => element.textContent.trim().replace(/\s{2,}/g, ' ');

                data[playerId] = {
                    estim: cleanText(estimCell)
                };
            }
        }
    });

    return data;
}

// Funkcja dodająca dane do istniejących elementów na stronie Sokker
function injectDataIntoSokkerPage(data) {

    const playerBoxes = document.querySelectorAll('.player-box-head__face > .player-face[data-pid]');

    playerBoxes.forEach(faceElement => {
        const playerId = faceElement.dataset.pid;
        const value = data[playerId];

        // --- LOKALIZACJA KONTENERA NAGŁÓWKA ---
        const listItem = faceElement.closest('.player-list__item');
        if (!listItem) return;
        const playerContentContainer = listItem.querySelector('.player-box__content');
        if (!playerContentContainer) return;
        const headerContainer = playerContentContainer.querySelector('.player-box__header > .player-box-header');
        if (!headerContainer) return;

        // Znajdź istniejące pole Wynagrodzenie (Salary), aby wstawić Estymację tuż przed nim
        const salaryContainer = headerContainer.querySelector('.player-box-header__salary');

        // --- LOGIKA WSTRZYKIWANIA ESTYMACJI ---
        if (value && salaryContainer) {
            const estimValue = value.estim;

            // 1. Usuń wcześniej wstawioną Estymację (zapobieganie duplikatom)
            const existingEstim = headerContainer.querySelector('.sktables-estim-value');
            if (existingEstim) {
                existingEstim.remove();
            }

            let displayValue = '0 zł';
            let displayColor = 'inherit';

            if (estimValue && !estimValue.includes('?') && !estimValue.toLowerCase().includes('n/a')) {
                displayValue = estimValue;
                displayColor = 'var(--c-valid)';
            }

            // 2. Utwórz nowy element Estymacji (na wzór Sokkerowego pola wartości)
            const estimDiv = document.createElement('div');
            estimDiv.className = 'player-box-header__value sktables-estim-value';
            estimDiv.innerHTML = `
                <span class="headline player-box-header-value player-box-header-value--has-columns-layout">
                    <span class="headline">Estymacja:</span>
                    <span class="headline fs-13 fs-15@&gt;mobile fw-800 ls-15" style="color: ${displayColor};">${displayValue}</span>
                </span>
            `;

            // 3. Wstaw nowy element Estymacji przed Wynagrodzeniem
            salaryContainer.before(estimDiv);

            // 4. Reset statusu ładowania na oryginalnym polu Wartość
            const valueSpan = playerContentContainer.querySelector('.player-box-header__value .headline:last-child');
            if (valueSpan && valueSpan.textContent.includes('Ładowanie SKT')) {
                // Przywracamy domyślną wartość lub zostawiamy, jak było pierwotnie
                valueSpan.textContent = '---'; // Może być np. '---' lub zostawić puste, Sokker wczyta swoją wartość
                valueSpan.style.color = 'inherit';
            }

        } else if (salaryContainer) {
            // Jeśli dane SKT są niedostępne, upewnij się, że nie pozostał status ładowania
            const valueSpan = playerContentContainer.querySelector('.player-box-header__value .headline:last-child');
            if (valueSpan && valueSpan.textContent.includes('Ładowanie SKT')) {
                valueSpan.textContent = '---'; // Przywróć pole wartości
                valueSpan.style.color = 'inherit';
            }
        }
    });

    console.log(`[CONTENT] Zakończono wstrzykiwanie Estymacji SKTables.`);
}


// --- GŁÓWNA LOGIKA WYKONYWANIA ---
(async () => {
    // 1. Ustawienie statusu ładowania na oryginalnym polu Wartość
    const playerValueSpans = document.querySelectorAll('.player-box-header__value .headline:last-child');
    playerValueSpans.forEach(span => {
        // Sprawdzamy, czy pole nie ma już wartości (Sokker wczytuje wartość z opóźnieniem w React)
        if (!span.textContent.includes('zł')) {
            span.textContent = "Ładowanie SKT... ⏳";
            span.style.color = 'orange';
        }
    });


    // 2. Pobierz HTML z SkTables
    getMyTeamValueHtml(response => {
        if (!response || !response.ok || !response.html) {
            console.error('[CONTENT] Błąd pobierania danych z SkTables:', response ? response.error : 'Brak odpowiedzi');
            playerValueSpans.forEach(span => {
                if (span.textContent.includes('Ładowanie SKT')) {
                    span.textContent = '---'; // Przywróć stan
                    span.style.color = 'inherit';
                }
            });
            return;
        }

        let parsedData;
        try {
            // 3. Parsowanie HTML i mapowanie danych
            parsedData = parseSkTablesHtml(response.html);
        } catch (e) {
            console.error('[CONTENT] Błąd parsowania HTML SkTables:', e);
            playerValueSpans.forEach(span => {
                if (span.textContent.includes('Ładowanie SKT')) {
                    span.textContent = '---'; // Przywróć stan
                    span.style.color = 'inherit';
                }
            });
            return;
        }

        // 4. Wstrzykiwanie danych do strony Sokker
        injectDataIntoSokkerPage(parsedData);
    });
})();