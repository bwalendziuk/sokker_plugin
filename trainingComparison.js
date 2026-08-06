// trainingComparison.js — Strona /app/training/player-info/{pid}/
// Dodaje przycisk "Porównaj z innym zawodnikiem": po kliknięciu pokazuje panel
// z listą (select) własnej drużyny, a po wyborze zawodnika - tabelę i wykres(y)
// porównujące historię treningową (wyrównaną wg wieku, nie kalendarzowego tygodnia).
// Tryb "porównaj wszystko" pokazuje pełną tabelę wszystkich umiejętności i siatkę
// mini-wykresów zamiast jednej wybranej umiejętności.

const COMPARISON_SKILLS = [
    { key: 'form', label: 'Forma' },
    { key: 'stamina', label: 'Kondycja' },
    { key: 'keeper', label: 'Bramkarz' },
    { key: 'pace', label: 'Szybkość' },
    { key: 'defending', label: 'Obrońca' },
    { key: 'technique', label: 'Technika' },
    { key: 'playmaking', label: 'Rozgrywający' },
    { key: 'passing', label: 'Podania' },
    { key: 'striker', label: 'Strzelec' }
];

const SUM_SKILL_KEYS = ['stamina', 'keeper', 'pace', 'defending', 'technique', 'playmaking', 'passing', 'striker'];

function sumSkills(report) {
    if (!report || !report.skills) return null;
    return SUM_SKILL_KEYS.reduce((sum, key) => sum + (report.skills[key] ?? 0), 0);
}

function getCurrentPlayerId() {
    const face = document.querySelector('.player-face[data-pid]');
    return face ? face.dataset.pid : null;
}

function getCurrentPlayerName() {
    const nameLink = document.querySelector('.player__name a');
    return nameLink ? nameLink.textContent.trim() : 'Ten zawodnik';
}

function injectComparisonStyles() {
    if (document.getElementById('subskill-comparison-styles')) return;
    const style = document.createElement('style');
    style.id = 'subskill-comparison-styles';
    style.textContent = `
        .subskill-comparison__table { width: 100%; border-collapse: collapse; font-size: 1.3rem; }
        .subskill-comparison__table th, .subskill-comparison__table td {
            padding: .4rem .8rem; text-align: center; border-bottom: 1px solid rgba(128,128,128,0.2);
            white-space: nowrap;
        }
        .subskill-comparison__chart-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr)); gap: 1.6rem;
        }
        .subskill-comparison__chart-cell canvas { max-width: 100%; }
        .subskill-comparison__chart-cell-title { font-weight: 700; margin-bottom: .4rem; text-align: center; }
    `;
    document.head.appendChild(style);
}

function createComparisonPanel() {
    const wrapper = document.createElement('div');
    wrapper.className = 'card card--theme-default subskill-comparison';
    wrapper.style.marginTop = '1.6rem';

    wrapper.innerHTML = `
        <div class="card__content" style="padding: 1.6rem;">
            <button type="button" class="btn btn--default btn--th-t15 t-first-letter-uppercase subskill-comparison__toggle">
                <span class="btn__wrap"><span>Porównaj z innym zawodnikiem</span></span>
            </button>
            <div class="subskill-comparison__panel" style="display:none; margin-top: 1.6rem;">
                <select class="subskill-comparison__player-select" style="width:100%; max-width:32rem; height:4rem; padding:0 1.6rem; border-radius:.6rem; border:2px solid var(--c-input-bg,#333); background-color: var(--c-input-bg,#222); color: inherit;">
                    <option value="">— wybierz zawodnika —</option>
                </select>
                <div class="subskill-comparison__status" style="margin-top:1rem;"></div>
                <div class="subskill-comparison__content" style="margin-top:1.6rem;"></div>
            </div>
        </div>
    `;

    return wrapper;
}

function setStatus(statusEl, text) {
    statusEl.textContent = text || '';
}

function highlightPair(row, keyA, keyB, valueA, valueB) {
    const cellA = row.querySelector(`[data-pair="${keyA}"]`);
    const cellB = row.querySelector(`[data-pair="${keyB}"]`);
    if (valueA == null || valueB == null) return;
    if (valueA > valueB) {
        cellA.style.color = '#1b9f7d';
        cellA.style.fontWeight = '700';
    } else if (valueB > valueA) {
        cellB.style.color = '#1b9f7d';
        cellB.style.fontWeight = '700';
    }
}

/**
 * @param skillDefs lista {key,label} umiejętności do pokazania jako osobne kolumny
 *                  (obok zawsze obecnej kolumny "Suma")
 */
function buildComparisonTable(rows, currentLabel, otherLabel, skillDefs) {
    const table = document.createElement('table');
    table.className = 'subskill-comparison__table';

    const skillHeaders = skillDefs.map(s => `<th>${s.label} (${currentLabel})</th><th>${s.label} (${otherLabel})</th>`).join('');

    table.innerHTML = `
        <thead>
            <tr>
                <th>Wiek</th>
                <th>Tydz.</th>
                <th>Suma (${currentLabel})</th>
                <th>Suma (${otherLabel})</th>
                ${skillHeaders}
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    rows.forEach(row => {
        if (!row.a && !row.b) return;

        const sumA = sumSkills(row.a);
        const sumB = sumSkills(row.b);

        const skillCells = skillDefs.map((s, i) => {
            const valueA = row.a?.skills?.[s.key] ?? null;
            const valueB = row.b?.skills?.[s.key] ?? null;
            return `<td data-pair="skill-a-${i}">${valueA ?? '-'}</td><td data-pair="skill-b-${i}">${valueB ?? '-'}</td>`;
        }).join('');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.age}</td>
            <td>${row.weekAtAge}</td>
            <td data-pair="sum-a">${sumA ?? '-'}</td>
            <td data-pair="sum-b">${sumB ?? '-'}</td>
            ${skillCells}
        `;
        tbody.appendChild(tr);

        highlightPair(tr, 'sum-a', 'sum-b', sumA, sumB);
        skillDefs.forEach((s, i) => {
            const valueA = row.a?.skills?.[s.key] ?? null;
            const valueB = row.b?.skills?.[s.key] ?? null;
            highlightPair(tr, `skill-a-${i}`, `skill-b-${i}`, valueA, valueB);
        });
    });

    return table;
}

function drawComparisonChart(canvas, rows, selectedSkill, currentLabel, otherLabel) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 24, right: 16, bottom: 26, left: 26 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const valuesA = rows.map(r => r.a?.skills?.[selectedSkill] ?? null);
    const valuesB = rows.map(r => r.b?.skills?.[selectedSkill] ?? null);
    const allValues = [...valuesA, ...valuesB].filter(v => v != null);

    if (allValues.length === 0) {
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.fillText('Brak danych', padding.left, padding.top + 20);
        return;
    }

    const maxValue = Math.max(...allValues, 1);
    const minValue = Math.min(...allValues, 0);
    const range = Math.max(maxValue - minValue, 1);

    const xForIndex = (i) => padding.left + (rows.length <= 1 ? 0 : (i / (rows.length - 1)) * plotWidth);
    const yForValue = (v) => padding.top + plotHeight - ((v - minValue) / range) * plotHeight;

    // Osie
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotHeight);
    ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
    ctx.stroke();

    // Znaczniki zmiany wieku
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    let lastAge = null;
    rows.forEach((row, i) => {
        if (row.age !== lastAge) {
            lastAge = row.age;
            const x = xForIndex(i);
            ctx.fillText(String(row.age), x, padding.top + plotHeight + 14);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + plotHeight);
            ctx.stroke();
        }
    });

    const drawLine = (values, color) => {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let drawing = false;
        values.forEach((value, i) => {
            if (value == null) {
                drawing = false;
                return;
            }
            const x = xForIndex(i);
            const y = yForValue(value);
            if (!drawing) {
                ctx.moveTo(x, y);
                drawing = true;
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        values.forEach((value, i) => {
            if (value == null) return;
            ctx.beginPath();
            ctx.arc(xForIndex(i), yForValue(value), 2, 0, Math.PI * 2);
            ctx.fill();
        });
    };

    drawLine(valuesA, 'rgb(54, 162, 235)');
    drawLine(valuesB, 'rgb(255, 99, 132)');

    // Legenda
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgb(54, 162, 235)';
    ctx.fillRect(padding.left, 4, 8, 8);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText(currentLabel, padding.left + 12, 12);

    const otherLabelX = padding.left + 12 + ctx.measureText(currentLabel).width + 16;
    ctx.fillStyle = 'rgb(255, 99, 132)';
    ctx.fillRect(otherLabelX, 4, 8, 8);
    ctx.fillStyle = '#fff';
    ctx.fillText(otherLabel, otherLabelX + 12, 12);
}

function buildControls(onModeChange) {
    const controls = document.createElement('div');
    controls.style.marginBottom = '1rem';
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '1.6rem';
    controls.style.flexWrap = 'wrap';

    controls.innerHTML = `
        <label>Umiejętność:
            <select class="subskill-comparison__skill-select" style="margin-left:.8rem; padding:.4rem .8rem;">
                ${COMPARISON_SKILLS.map(s => `<option value="${s.key}">${s.label}</option>`).join('')}
            </select>
        </label>
        <label style="display:flex; align-items:center; gap:.6rem; cursor:pointer;">
            <input type="checkbox" class="subskill-comparison__compare-all">
            Porównaj wszystko
        </label>
    `;

    const skillSelect = controls.querySelector('.subskill-comparison__skill-select');
    const compareAllCheckbox = controls.querySelector('.subskill-comparison__compare-all');

    const syncDisabled = () => {
        skillSelect.disabled = compareAllCheckbox.checked;
    };

    skillSelect.addEventListener('change', onModeChange);
    compareAllCheckbox.addEventListener('change', () => {
        syncDisabled();
        onModeChange();
    });
    syncDisabled();

    return { controls, skillSelect, compareAllCheckbox };
}

async function renderComparisonContent(container, currentPlayerId, currentLabel, otherPlayer, statusEl) {
    container.innerHTML = '';
    setStatus(statusEl, `Pobieranie historii treningowej: ${currentLabel} i ${otherPlayer.name}...`);

    let reportsA, reportsB;
    try {
        [reportsA, reportsB] = await Promise.all([
            getTrainingReports(currentPlayerId),
            getTrainingReports(otherPlayer.id)
        ]);
    } catch (err) {
        setStatus(statusEl, `Błąd pobierania danych: ${err.message}`);
        return;
    }

    if (reportsA.length === 0 || reportsB.length === 0) {
        setStatus(statusEl, 'Brak danych treningowych dla jednego z zawodników.');
        return;
    }

    setStatus(statusEl, '');

    const rows = alignReportsByAge(reportsA, reportsB);

    const chartWrap = document.createElement('div');
    const tableWrap = document.createElement('div');
    tableWrap.style.maxHeight = '40rem';
    tableWrap.style.overflowY = 'auto';
    tableWrap.style.marginTop = '1.6rem';

    const rerender = () => {
        const compareAll = compareAllCheckbox.checked;
        const skillDefs = compareAll ? COMPARISON_SKILLS : [COMPARISON_SKILLS.find(s => s.key === skillSelect.value)];

        chartWrap.innerHTML = '';
        if (compareAll) {
            const grid = document.createElement('div');
            grid.className = 'subskill-comparison__chart-grid';
            COMPARISON_SKILLS.forEach(s => {
                const cell = document.createElement('div');
                cell.className = 'subskill-comparison__chart-cell';
                const title = document.createElement('div');
                title.className = 'subskill-comparison__chart-cell-title';
                title.textContent = s.label;
                const canvas = document.createElement('canvas');
                canvas.width = 320;
                canvas.height = 160;
                cell.appendChild(title);
                cell.appendChild(canvas);
                grid.appendChild(cell);
                drawComparisonChart(canvas, rows, s.key, currentLabel, otherPlayer.name);
            });
            chartWrap.appendChild(grid);
        } else {
            const single = document.createElement('div');
            single.style.textAlign = 'center';
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 300;
            canvas.style.maxWidth = '100%';
            single.appendChild(canvas);
            chartWrap.appendChild(single);
            drawComparisonChart(canvas, rows, skillDefs[0].key, currentLabel, otherPlayer.name);
        }

        tableWrap.innerHTML = '';
        tableWrap.appendChild(buildComparisonTable(rows, currentLabel, otherPlayer.name, skillDefs));
    };

    const { controls, skillSelect, compareAllCheckbox } = buildControls(rerender);

    container.appendChild(controls);
    container.appendChild(chartWrap);
    container.appendChild(tableWrap);

    rerender();
}

function initTrainingComparison() {
    const boxes = document.querySelector('.boxes');
    if (!boxes || document.querySelector('.subskill-comparison')) return;

    const currentPlayerId = getCurrentPlayerId();
    if (!currentPlayerId) return;

    injectComparisonStyles();

    const currentLabel = getCurrentPlayerName();
    const panel = createComparisonPanel();
    boxes.insertAdjacentElement('afterend', panel);

    const toggleBtn = panel.querySelector('.subskill-comparison__toggle');
    const panelBody = panel.querySelector('.subskill-comparison__panel');
    const playerSelect = panel.querySelector('.subskill-comparison__player-select');
    const statusEl = panel.querySelector('.subskill-comparison__status');
    const contentEl = panel.querySelector('.subskill-comparison__content');

    let ownPlayersById = null;

    toggleBtn.addEventListener('click', () => {
        const isHidden = panelBody.style.display === 'none';
        panelBody.style.display = isHidden ? 'block' : 'none';

        if (isHidden && !ownPlayersById) {
            setStatus(statusEl, 'Wczytywanie składu...');
            fetchOwnPlayersForComparison()
                .then(players => {
                    setStatus(statusEl, '');
                    const filtered = players.filter(p => String(p.id) !== String(currentPlayerId));
                    ownPlayersById = new Map(filtered.map(p => [String(p.id), p]));
                    filtered.forEach(player => {
                        const option = document.createElement('option');
                        option.value = player.id;
                        option.textContent = player.name;
                        playerSelect.appendChild(option);
                    });
                })
                .catch(err => {
                    setStatus(statusEl, `Błąd wczytywania składu: ${err.message}`);
                });
        }
    });

    playerSelect.addEventListener('change', () => {
        const selectedId = playerSelect.value;
        if (!selectedId || !ownPlayersById) {
            contentEl.innerHTML = '';
            return;
        }
        const player = ownPlayersById.get(selectedId);
        if (!player) return;
        renderComparisonContent(contentEl, currentPlayerId, currentLabel, player, statusEl);
    });
}

// Strona jest SPA (React) - w momencie uruchomienia content scriptu (document_idle)
// ".boxes" może jeszcze nie istnieć w DOM, jeśli dane gracza wczytują się asynchronicznie.
// initTrainingComparison() samo pilnuje, żeby nie wstawić panelu drugi raz, więc
// bezpiecznie odpalamy je ponownie przy każdej zmianie DOM, aż się uda.
initTrainingComparison();

const trainingComparisonObserver = new MutationObserver(() => initTrainingComparison());
trainingComparisonObserver.observe(document.body, { childList: true, subtree: true });
