// helper/trainingComparisonApi.js
// Dostęp do wewnętrznego API sokker.org (ten sam origin co strona, więc fetch
// bezpośrednio z content scriptu - bez pośrednictwa background.js, bo nie ma tu CORS-a
// jak w przypadku sktables.org) na potrzeby porównania historii treningowej zawodników.

const TRAINING_REPORT_PAGE_SIZE = 100;
const TRAINING_REPORT_MAX_PAGES = 50; // bezpiecznik przed niekończącą się paginacją
const TRAINING_REPORT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

async function fetchSokkerApi(path) {
    const res = await fetch(`/api${path}`, { credentials: 'same-origin' });
    if (!res.ok) {
        throw new Error(`Błąd API sokker.org (${res.status}): ${path}`);
    }
    return res.json();
}

async function fetchTrainingReportPage(playerId, offset, limit) {
    const data = await fetchSokkerApi(`/training/${playerId}/report?filter[limit]=${limit}&filter[offset]=${offset}`);
    return Array.isArray(data.reports) ? data.reports : [];
}

async function fetchAllTrainingReports(playerId) {
    const allReports = [];
    let offset = 0;
    for (let page = 0; page < TRAINING_REPORT_MAX_PAGES; page++) {
        const reports = await fetchTrainingReportPage(playerId, offset, TRAINING_REPORT_PAGE_SIZE);
        allReports.push(...reports);
        if (reports.length < TRAINING_REPORT_PAGE_SIZE) break;
        offset += TRAINING_REPORT_PAGE_SIZE;
    }
    return allReports;
}

function trainingReportCacheKey(playerId) {
    return `training_report_${playerId}`;
}

async function getCachedTrainingReports(playerId) {
    const key = trainingReportCacheKey(playerId);
    const stored = await chrome.storage.local.get(key);
    return stored[key] || null;
}

async function setCachedTrainingReports(playerId, reports) {
    const key = trainingReportCacheKey(playerId);
    await chrome.storage.local.set({ [key]: { reports, fetchedAt: Date.now() } });
}

/**
 * Zwraca pełną historię treningową zawodnika (wszystkie tygodnie).
 * Korzysta z cache w chrome.storage.local (TTL 6h), żeby nie odpytywać API
 * przy każdym otwarciu panelu porównania - historia sprzed tego tygodnia i tak się nie zmienia.
 */
async function getTrainingReports(playerId, { forceRefresh = false } = {}) {
    const cached = await getCachedTrainingReports(playerId);
    const isFresh = cached && (Date.now() - cached.fetchedAt) < TRAINING_REPORT_CACHE_TTL_MS;
    if (cached && isFresh && !forceRefresh) {
        return cached.reports;
    }
    const reports = await fetchAllTrainingReports(playerId);
    await setCachedTrainingReports(playerId, reports);
    return reports;
}

async function fetchCurrentTeamId() {
    const current = await fetchSokkerApi('/current');
    return current?.team?.id ?? null;
}

async function fetchTeamPlayers(teamId) {
    const allPlayers = [];
    let offset = 0;
    for (let page = 0; page < TRAINING_REPORT_MAX_PAGES; page++) {
        const data = await fetchSokkerApi(`/team/${teamId}/player?filter[limit]=${TRAINING_REPORT_PAGE_SIZE}&filter[offset]=${offset}`);
        const players = Array.isArray(data.players) ? data.players : [];
        allPlayers.push(...players);
        if (players.length < TRAINING_REPORT_PAGE_SIZE) break;
        offset += TRAINING_REPORT_PAGE_SIZE;
    }
    return allPlayers;
}

/**
 * Zwraca listę własnych (seniorskich) zawodników do wyboru w porównywarce: {id, name}.
 */
async function fetchOwnPlayersForComparison() {
    const teamId = await fetchCurrentTeamId();
    if (!teamId) return [];
    const players = await fetchTeamPlayers(teamId);
    return players
        .map(p => ({ id: p.id, name: p.info?.name?.full ?? `#${p.id}` }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}
