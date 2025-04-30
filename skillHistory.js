
function createSkillsTable(player, diff = null) {
    const table = document.createElement('table');
    table.classList.add('table');
    table.style.backgroundColor = '#1e2e5c';

    const rows = [
        { label: 'kondycja', value: player.stam, key: 'stam' },
        { label: 'bramkarz', value: player.gk, key: 'gk' },
        { label: 'szybkość', value: player.pace, key: 'pace' },
        { label: 'obrońca', value: player.def, key: 'def' },
        { label: 'technika', value: player.tech, key: 'tech' },
        { label: 'rozgrywający', value: player.play, key: 'play' },
        { label: 'podania', value: player.pass, key: 'pass' },
        { label: 'strzelec', value: player.str, key: 'str' }
    ];

    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');

    for (let i = 0; i < rows.length; i++) {
        const data = rows[i];
        if (!data) continue;

        const skillName = skills[data.value] || 'brak';

        let valueDisplay = `${data.value}`;
        let deltaDisplay = '';

        if (diff && diff[data.key] !== 0) {
            const delta = diff[data.key];
            const sign = delta > 0 ? '+' : '';
            const color = delta > 0 ? '#1b9f7d' : '#c92c28';
            deltaDisplay = ` <span style="color: ${color}; font-weight: bold;">(${sign}${delta})</span>`;
        }

        const div = document.createElement('div');
        div.innerHTML = `${skillName} ${valueDisplay}${deltaDisplay} ${data.label}`;

        if (i % 2 === 0) {
            td1.appendChild(div);
        } else {
            td2.appendChild(div);
        }
    }

    tr.appendChild(td1);
    tr.appendChild(td2);
    table.appendChild(tr);
    return table;
}


async function modifyTableWithSkills(playersData) {
    const table = document.querySelector(".table tbody");
    if (!table) return console.error("Tabela nie znaleziona.");

    const rows = table.querySelectorAll("tr");

    const diffs = playersData.map((curr, i) => {
        const next = playersData[i + 1];
        if (!next) return null;

        return {
            stam: curr.stam - next.stam,
            gk: curr.gk - next.gk,
            pace: curr.pace - next.pace,
            def: curr.def - next.def,
            tech: curr.tech - next.tech,
            play: curr.play - next.play,
            pass: curr.pass - next.pass,
            str: curr.str - next.str
        };
    });

    for (let i = 1; i < rows.length - 1; i++) {
        const player = playersData[i - 1];
        const diff = player ? diffs[i - 1] || null : null;
        const firstCell = rows[i].querySelector("td");
        if (firstCell && player?.tr_time) {
            firstCell.textContent += ` ${player.tr_time}`;
        }
        const seasonCell = document.createElement('td');
        seasonCell.textContent = player?.season ?? '';
        rows[i].insertBefore(seasonCell, rows[i].children[rows[i].children.length - 1]);
        const weekCell = document.createElement('td');
        weekCell.textContent = player?.week ?? '';
        rows[i].insertBefore(weekCell, rows[i].children[rows[i].children.length - 1]);
        const ageCell = document.createElement('td');
        ageCell.textContent = player?.age ?? '';
        rows[i].insertBefore(ageCell, rows[i].children[rows[i].children.length - 1]);
        const newCell = document.createElement('td');
        newCell.classList.add('skills-cell');
        if (player) {
            newCell.appendChild(createSkillsTable(player, diff));
        }
        const cells = Array.from(rows[i].children).filter(child => child.tagName === "TD");

        if (cells.length >= 2) {
            rows[i].insertBefore(newCell, cells[cells.length - 1]);
        } else {
            rows[i].appendChild(newCell);
        }
    }
}

function modifyTableHeader() {
    const headerRow = document.querySelector(".table thead tr") || document.querySelector(".table tr");
    if (!headerRow) return;

    const ths = Array.from(headerRow.children).filter(el => el.tagName === 'TH');

    const seasonHeader = document.createElement('th');
    seasonHeader.textContent = 'season';
    headerRow.insertBefore(seasonHeader, ths[ths.length - 1]);

    const weekHeader = document.createElement('th');
    weekHeader.textContent = 'week';
    headerRow.insertBefore(weekHeader, ths[ths.length - 1]);

    const ageHeader = document.createElement('th');
    ageHeader.textContent = 'age';

    headerRow.insertBefore(ageHeader, ths[ths.length - 1]);

    const skillsHeader = document.createElement('th');
    skillsHeader.textContent = 'skills';

    headerRow.insertBefore(skillsHeader, ths[ths.length - 1]);


}

function fixColspanForFooter() {
    const table = document.querySelector('.table');
    if (!table) return;

    const footerRows = table.querySelectorAll('tr');
    for (const row of footerRows) {
        const td = row.querySelector('td[colspan]');
        if (td) {
            const current = parseInt(td.getAttribute('colspan'), 10);
            if (current === 4) {
                td.setAttribute('colspan', '8');
            }
        }
    }
}


async function main() {
    const el = document.querySelector(".navbar-brand");
    if (el) {
        const pidRaw = el.innerText || el.textContent;
        const pid = extractPid(pidRaw);
        try {
            const transferList = await runSQL(`SELECT * FROM transfers_with_sumskills_pln WHERE pid = ${pid} and price_pln is not null ORDER BY transfer_date DESC`);

            if (!transferList || !transferList.values || transferList.values.length === 0) {
                console.error('Brak danych transferów.');
                return;
            }

            const playerData = mapSQLResult(transferList);
            console.log(playerData);
            modifyTableHeader();
            fixColspanForFooter();
            await modifyTableWithSkills(playerData);
        } catch (err) {
            console.error('Błąd przy pobieraniu transferów:', err);
        }
    }
}

main(); // uruchamiamy funkcję