// helper/alignReportsByAge.js
// Wyrównuje dwie historie treningowe (z /training/{playerId}/report) po wieku zawodnika,
// a nie po kalendarzowym tygodniu - żeby móc porównać np. 20-latka z 17-latkiem
// w tygodniu, w którym ten pierwszy też miał 17 lat.

function indexTrainingReportsByAge(reports) {
    const sorted = [...reports].sort((a, b) => a.week - b.week);
    const countersByAge = {};
    return sorted.map(report => {
        const age = report.age;
        const weekAtAge = countersByAge[age] ?? 0;
        countersByAge[age] = weekAtAge + 1;
        return { ...report, weekAtAge };
    });
}

/**
 * @param reportsA lista raportów pierwszego zawodnika (z /training/{playerId}/report)
 * @param reportsB lista raportów drugiego zawodnika
 * @returns tablica wierszy {age, weekAtAge, a, b} posortowana wg wieku i tygodnia w tym
 *          wieku; jeśli któryś z zawodników nie ma wpisu dla danej kombinacji, pole a/b jest null
 */
function alignReportsByAge(reportsA, reportsB) {
    const indexedA = indexTrainingReportsByAge(reportsA || []);
    const indexedB = indexTrainingReportsByAge(reportsB || []);

    const byKey = (list) => {
        const map = new Map();
        list.forEach(r => map.set(`${r.age}:${r.weekAtAge}`, r));
        return map;
    };

    const mapA = byKey(indexedA);
    const mapB = byKey(indexedB);

    const keys = new Set([...mapA.keys(), ...mapB.keys()]);

    const rows = [...keys].map(key => {
        const [age, weekAtAge] = key.split(':').map(Number);
        return { age, weekAtAge, a: mapA.get(key) || null, b: mapB.get(key) || null };
    });

    rows.sort((r1, r2) => (r1.age - r2.age) || (r1.weekAtAge - r2.weekAtAge));
    return rows;
}
