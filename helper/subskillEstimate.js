// Port kalkulatora "Sokker - Subskill calculator" (skrypt strony trzeciej).
// Na podstawie widocznych (całkowitych) umiejętności, formy oraz realnej wartości
// rynkowej zawodnika szacuje ukrytą część dziesiętną ("subskill") jego umiejętności.

const SUBSKILL_TRAINING_MULTIPLIER = 1.088;
const SUBSKILL_EXP_MULTIPLIER = 1.252;
const SUBSKILL_BASE_VALUE = 1588;
const SUBSKILL_FORM_MULTIPLIER = 0.0257;
const SUBSKILL_STAMINA_BASE_VALUE = 216.4;
const SUBSKILL_STAMINA_EXP_MULTIPLIER = 1.511;

function buildSubskillTable() {
    const baseValues = [0, SUBSKILL_BASE_VALUE];
    for (let i = 0; i < 18; i++) {
        baseValues.push(baseValues[baseValues.length - 1] * SUBSKILL_TRAINING_MULTIPLIER);
    }

    const skillTable = [0, SUBSKILL_BASE_VALUE];
    for (let i = 0; i < 18; i++) {
        skillTable.push(skillTable[skillTable.length - 1] + baseValues[i + 2]);
    }
    return skillTable;
}

const SUBSKILL_TABLE = buildSubskillTable();

/**
 * @param skills [stamina, keeper, pace, defender, technique, playmaker, passing, striker]
 * @param form forma zawodnika, liczba 0-18
 * @param bonus dodatkowa część dziesiętna doliczana do każdej umiejętności (0-1)
 * @param formType "dynamic" (forma ma tę samą część dziesiętną co bonus - wartość oczekiwana),
 *                 "min" (forma bez części dziesiętnej - najgorszy przypadek) lub
 *                 "max" (forma + 1 - najlepszy przypadek), używane do wyznaczenia przedziału
 */
function calculateValueFromSkills(skills, form, bonus, formType = 'dynamic') {
    const [stam, keep, pace, def, tech, play, pass, str] = skills;

    let value = (stam + bonus) * SUBSKILL_STAMINA_BASE_VALUE * SUBSKILL_STAMINA_EXP_MULTIPLIER ** (stam + bonus);

    const rawSkills = [keep, pace, def, tech, play, pass, str];
    let isGk = true;

    rawSkills.forEach(raw => {
        const skillValue = Math.min(raw + bonus, 18);
        const skillFl = Math.floor(skillValue);
        const skillOff = skillValue - skillFl;

        let skillVal = SUBSKILL_TABLE[skillFl] + (SUBSKILL_TABLE[skillFl + 1] - SUBSKILL_TABLE[skillFl]) * skillOff;
        skillVal *= SUBSKILL_EXP_MULTIPLIER ** skillValue;

        value += isGk ? 4 * skillVal : skillVal;
        isGk = false;
    });

    let newForm;
    if (formType === 'min') newForm = form;
    else if (formType === 'max') newForm = form + 1;
    else newForm = form + bonus;

    if (newForm < 18) {
        value *= 1 - (18 - newForm) * SUBSKILL_FORM_MULTIPLIER;
    }

    return value;
}

function roundSubskillValue(value) {
    return Math.round(Math.round(value / 1000) * 1000);
}

function binarySearchSubskill(skills, form, realValue, formType) {
    let min = 0;
    let max = 1000;

    while (min <= max) {
        const mid = Math.floor((min + max) / 2);
        const value = calculateValueFromSkills(skills, form, mid / 1000, formType);
        if (value <= realValue) min = mid + 1;
        else max = mid - 1;
    }
    return Math.min(min, 1000);
}

/**
 * Szacuje "subskill" (ukrytą część dziesiętną umiejętności) na podstawie realnej wartości zawodnika w zł.
 * @returns {{
 *   error?: string,
 *   avgSubskill?: number,
 *   intervalMin?: number|null,
 *   intervalMax?: number|null,
 *   minVal?: number, avgVal?: number, maxVal?: number
 * }}
 */
function estimateSubskill(skills, form, realValuePln) {
    if (!Array.isArray(skills) || skills.length !== 8 || form == null || realValuePln == null || isNaN(realValuePln)) {
        return { error: 'Brak danych do wyliczenia subskilla' };
    }

    const minVal = roundSubskillValue(calculateValueFromSkills(skills, form, 0));
    const avgVal = roundSubskillValue(calculateValueFromSkills(skills, form, 0.5));
    const maxVal = roundSubskillValue(calculateValueFromSkills(skills, form, 1));

    if (minVal > realValuePln) {
        return { error: 'Rzeczywista wartość jest niższa niż wartość minimalna', minVal, avgVal, maxVal };
    }
    if (maxVal < realValuePln) {
        return { avgSubskill: 1, intervalMin: null, intervalMax: null, minVal, avgVal, maxVal };
    }

    const avgNormal = binarySearchSubskill(skills, form, realValuePln, 'dynamic');
    const avgMin = binarySearchSubskill(skills, form, realValuePln, 'max');
    const avgMax = binarySearchSubskill(skills, form, realValuePln, 'min');

    return {
        avgSubskill: avgNormal / 1000,
        intervalMin: avgMin !== avgMax ? avgMin / 1000 : null,
        intervalMax: avgMin !== avgMax ? avgMax / 1000 : null,
        minVal,
        avgVal,
        maxVal
    };
}
