// content.js — działa na stronie https://sokker.org/juniors/...

// helper: pobiera HTML ze SkTables przez background.js
function getTalentHtml(id, callback) {
    chrome.runtime.sendMessage(
        { action: "calcTalent", id: id },
        response => callback(response)
    );
}

// Funkcja parsowania DOM, zwraca wszystkie dane
function parseSkTablesHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let talentMin = null;
    let talentMax = null;
    let talentConfidence = null;
    let playerLevel = null;
    let playerGrade = null;
    let exitAge = null;

    // 1. Parsowanie Talent Range i Status
    const talentSummary = doc.querySelector('.max-w-8.box > details > summary > span:first-child');
    const statusSpan = doc.querySelector('.max-w-8.box > details > summary > span:last-child');

    if (talentSummary) {
        const text = talentSummary.textContent.match(/Talent:\s*([\d.]+)\s*to\s*([\d.]+)/i);
        if (text) {
            talentMin = parseFloat(text[1]);
            talentMax = parseFloat(text[2]);
        }
    }

    if (statusSpan) {
        const statusText = statusSpan.textContent.trim();
        const confidenceMatch = statusText.match(/\(([\d]+)%\)/);

        if (confidenceMatch) {
            talentConfidence = parseInt(confidenceMatch[1], 10);
        } else if (statusText.toLowerCase().includes('unconfirmed')) {
            talentConfidence = 0;
        } else {
            talentConfidence = null;
        }
    }

    // 2. Parsowanie Info Zawodnika (Level, Grade, Exit Age)
    const playerInfoP = doc.querySelector('.max-w-8.box > p:nth-child(2)');

    if (playerInfoP) {
        const textContent = playerInfoP.textContent;

        const gradeSpan = playerInfoP.querySelector('.tag');
        if (gradeSpan) {
            playerGrade = gradeSpan.textContent.trim();
        }

        const lvlMatch = textContent.match(/level.*?([\d.]+)/i);
        if (lvlMatch) {
            playerLevel = parseFloat(lvlMatch[1]);
        }

        const ageMatch = textContent.match(/Estimated at release.*?([\d.]+y)/i);
        if (ageMatch) {
            exitAge = ageMatch[1].trim();
        }
    }

    return {
        talent: { min: talentMin, max: talentMax, confidence: talentConfidence },
        player_info: { level: playerLevel, grade: playerGrade, exit_age: exitAge }
    };
}


// główna logika
(async () => {
    const rows = document.querySelectorAll('tr[id^="juniorRow"]');
    if (!rows.length) return;

    // Znajdź wiersz nagłówka
    const headerRow = document.querySelector('table.table tr.h5.title-block-2.text-primary');

    // Znajdujemy ostatnią komórkę akcji ('zrezygnuj') w wierszu nagłówkowym
    const actionHeaderCell = headerRow ? headerRow.querySelector("td:last-child") : null;

    if (headerRow && actionHeaderCell) {

        // --- DODAJEMY NOWE NAGŁÓWKI (td) ---

        // 1. Grade (Ocena)
        const gradeTh = document.createElement("td");
        // gradeTh.style.width = "8%";
        gradeTh.style.textAlign = "center";
        gradeTh.innerHTML = '<strong><a class="h5 title-block-2 text-primary" style=" padding: 0 0 0 0; border-bottom: 0px;" href="#">ocena</a></strong>';
        headerRow.insertBefore(gradeTh, actionHeaderCell);

        // 2. Talent
        const talentTh = document.createElement("td");
        talentTh.style.width = "18%";
        talentTh.style.textAlign = "center";
        talentTh.innerHTML = '<strong><a class="h5 title-block-2 text-primary" style=" padding: 0 0 0 0; border-bottom: 0px;" href="#">talent (%)</a></strong>';
        headerRow.insertBefore(talentTh, gradeTh);

        // 3. Wiek wyjścia (Exit Age)
        const ageTh = document.createElement("td");
        // ageTh.style.width = "10%";
        ageTh.style.textAlign = "center";
        ageTh.innerHTML = '<strong><a class="h5 title-block-2 text-primary" style=" padding: 0 0 0 0; border-bottom: 0px;" href="#">wiek</a></strong>';
        headerRow.insertBefore(ageTh, talentTh);

        // 4. Level (Poziom)
        const levelTh = document.createElement("td");
        // levelTh.style.width = "15%"; // Zwiększony, aby pomieścić nazwę umiejętności
        levelTh.style.textAlign = "center";
        levelTh.innerHTML = '<strong><a class="h5 title-block-2 text-primary" style=" padding: 0 0 0 0; border-bottom: 0px;" href="#">lvl</a></strong>';
        headerRow.insertBefore(levelTh, ageTh);

    }


    for (const row of rows) {

        const id = row.id.replace("juniorRow", "");

        // Referencyjna komórka do wstawienia: oryginalna ostatnia komórka akcji (z przyciskiem zrezygnuj)
        const actionTd = row.querySelector("td:last-child");

        // --- TWORZYMY NOWE KOMÓRKI W WIERSZU (wstawiamy przed akcją) ---

        // 1. Kolumna Grade
        const gradeTd = document.createElement("td");
        gradeTd.style.textAlign = "center";
        gradeTd.textContent = "⌛";
        row.insertBefore(gradeTd, actionTd);

        // 2. Kolumna Talent
        const talentTd = document.createElement("td");
        talentTd.style.textAlign = "center";
        talentTd.textContent = "⌛";
        row.insertBefore(talentTd, gradeTd);

        // 3. Kolumna Exit Age
        const ageTd = document.createElement("td");
        ageTd.style.textAlign = "center";
        ageTd.textContent = "⌛";
        row.insertBefore(ageTd, talentTd);

        // 4. Kolumna Level
        const levelTd = document.createElement("td");
        levelTd.style.textAlign = "center";
        levelTd.textContent = "⌛";
        row.insertBefore(levelTd, ageTd);


        // POBIERANIE DANYCH
        try {
            getTalentHtml(id, response => {
                if (!response || !response.ok || !response.html) {
                    const errorText = "ERR";
                    levelTd.textContent = errorText;
                    ageTd.textContent = errorText;
                    talentTd.textContent = errorText;
                    gradeTd.textContent = errorText;
                    console.error(`Error fetching HTML for ID ${id}:`, response ? response.error : 'No response');
                    return;
                }

                let resultJson;
                try {
                    resultJson = parseSkTablesHtml(response.html);
                } catch (e) {
                    console.error(`Error parsing HTML for ID ${id}:`, e);
                    levelTd.textContent = "PARSE ERR";
                    ageTd.textContent = "PARSE ERR";
                    talentTd.textContent = "PARSE ERR";
                    gradeTd.textContent = "PARSE ERR";
                    return;
                }

                const { talent, player_info } = resultJson;
                const confidence = talent.confidence !== null ? `${talent.confidence}%` : "N/A";

                // Wypełnienie kolumny Level
                if (player_info.level != null) {
                    const roundedLevel = Math.round(player_info.level);
                    const skillName = skills[roundedLevel] || `(brak: ${roundedLevel})`;

                    // DODANIE NAZWY SKILLA OBOK LICZBY
                    levelTd.innerHTML = `<strong>${roundedLevel}</strong> <span style="font-size: 0.8em; opacity: 0.8;">(${skillName})</span>`;
                } else {
                    levelTd.textContent = "N/A";
                }

                // Wypełnienie kolumny Exit Age
                if (player_info.exit_age != null) {
                    ageTd.textContent = player_info.exit_age;
                } else {
                    ageTd.textContent = "N/A";
                }

                // Wypełnienie kolumny Grade
                if (player_info.grade != null) {
                    gradeTd.textContent = player_info.grade;
                } else {
                    gradeTd.textContent = "N/A";
                }

                // Wypełnienie kolumny Talent (z procentem pewności)
                if (talent.min != null && talent.max != null) {
                    const talentRange = `${talent.min.toFixed(1)}–${talent.max.toFixed(1)}`;

                    talentTd.innerHTML = `<strong>${talentRange}</strong> <span style="font-size: 0.8em; opacity: 0.8;">(${confidence})</span>`;
                } else {
                    talentTd.textContent = "N/A";
                }

            });

        } catch (e) {
            console.error("Junior processing error", id, e);
            levelTd.textContent = "JS ERR";
            ageTd.textContent = "JS ERR";
            talentTd.textContent = "JS ERR";
            gradeTd.textContent = "JS ERR";
        }
    }
})();