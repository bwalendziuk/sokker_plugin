// trainingPlayerInfo.js — Działa na stronie /app/training/player-info/{pid}/
// Wstrzykuje oszacowanie subskilla (helper/subskillEstimate.js) pod polem
// "wynagrodzenie" w boksie z ogólnymi informacjami o zawodniku.

function parsePlnValue(text) {
    if (!text) return null;
    const match = text.match(/([\d\s]+)zł/);
    if (!match) return null;
    const digits = match[1].replace(/\D/g, '');
    return digits ? Number(digits) : null;
}

function findGeneralGroup(root, label) {
    const groups = [...root.querySelectorAll('.general__head-group')];
    return groups.find(g => {
        const title = g.querySelector('.general__head-title');
        return title && title.textContent.trim().toLowerCase() === label;
    }) || null;
}

function findSkillItem(root, label) {
    const items = [...root.querySelectorAll('.skill-list__item')];
    return items.find(li => {
        const labelSpan = li.querySelector('.skill-list-item .text-overflow');
        return labelSpan && labelSpan.textContent.trim().toLowerCase() === label;
    }) || null;
}

function getSkillNumber(root, label) {
    const item = findSkillItem(root, label);
    if (!item) return null;
    const valueSpan = item.querySelector('.skill-list__value > .headline');
    const value = valueSpan ? parseInt(valueSpan.textContent.trim(), 10) : NaN;
    return isNaN(value) ? null : value;
}

function createGeneralGroup(label, valueText) {
    const group = document.createElement('div');
    group.className = 'general__head-group subskill-estimate';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'general__head-title';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'headline fs-14 fs-16@>mobile fw-400 ls-10';
    titleSpan.textContent = label;
    titleWrap.appendChild(titleSpan);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'headline fs-15 fs-18@>mobile fw-600 ls-10';
    valueSpan.textContent = valueText;

    group.appendChild(titleWrap);
    group.appendChild(valueSpan);
    return group;
}

function renderTrainingSubskillEstimate() {
    const generalBox = document.querySelector('.boxes__general');
    const skillsBox = document.querySelector('.boxes__skills');
    const skillsSecondaryBox = document.querySelector('.boxes__skills-secondary');
    if (!generalBox || !skillsBox || !skillsSecondaryBox) return;

    const wageGroup = findGeneralGroup(generalBox, 'wynagrodzenie');
    const valueGroup = findGeneralGroup(generalBox, 'wartość');
    if (!wageGroup || !valueGroup) return;

    const valueSpan = valueGroup.querySelector('.general__head-title')?.nextElementSibling;
    const realValuePln = parsePlnValue(valueSpan ? valueSpan.textContent : null);

    const formaItem = findSkillItem(skillsSecondaryBox, 'forma');
    const formaSpan = formaItem ? formaItem.querySelector('.skill-list__value > .headline') : null;
    const form = formaSpan ? parseInt(formaSpan.textContent.trim(), 10) : null;

    // Kolejność zgodna z helper/subskillEstimate.js: stamina, keeper, pace, defender, technique, playmaker, passing, striker
    const skills = [
        getSkillNumber(skillsBox, 'kondycja'),
        getSkillNumber(skillsBox, 'bramkarz'),
        getSkillNumber(skillsBox, 'szybkość'),
        getSkillNumber(skillsBox, 'obrońca'),
        getSkillNumber(skillsBox, 'technika'),
        getSkillNumber(skillsBox, 'rozgrywający'),
        getSkillNumber(skillsBox, 'podania'),
        getSkillNumber(skillsBox, 'strzelec')
    ];

    let signature = 'incomplete';
    let result = null;
    if (!skills.some(s => s == null) && form != null && realValuePln != null) {
        result = estimateSubskill(skills, form, realValuePln);
        signature = JSON.stringify({ skills, form, realValuePln });
    }

    // Strona jest SPA (React) — ten sam kontener bywa odświeżany po nawigacji strzałkami
    // prev/next bez przeładowania. Jeśli dane się nie zmieniły, nic nie ruszamy (żeby
    // nie zapętlić się z MutationObserverem poniżej).
    if (generalBox.dataset.subskillSignature === signature) return;
    generalBox.dataset.subskillSignature = signature;

    generalBox.querySelectorAll('.subskill-estimate').forEach(el => el.remove());

    if (!result) return;

    if (result.error && result.avgSubskill == null) {
        wageGroup.insertAdjacentElement('afterend', createGeneralGroup('subskill', result.error));
        return;
    }

    const avgGroup = createGeneralGroup('expected subskill', result.avgSubskill.toFixed(3));
    avgGroup.title = `wartość min: ${result.minVal} zł, śr.: ${result.avgVal} zł, maks: ${result.maxVal} zł`;
    wageGroup.insertAdjacentElement('afterend', avgGroup);

    if (result.intervalMin !== null && result.intervalMax !== null) {
        const intervalGroup = createGeneralGroup('possible subskill', `${result.intervalMin.toFixed(3)} - ${result.intervalMax.toFixed(3)}`);
        intervalGroup.title = 'Zależy od nieznanej części dziesiętnej formy';
        avgGroup.insertAdjacentElement('afterend', intervalGroup);
    }
}

renderTrainingSubskillEstimate();

const trainingSubskillObserver = new MutationObserver(() => renderTrainingSubskillEstimate());
trainingSubskillObserver.observe(document.body, { childList: true, subtree: true });
