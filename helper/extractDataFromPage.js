function extractPid(text) {
    const match = text.match(/\[(\d+)\]/);
    return match ? match[1] : null;
}

function extractPlayerData(panelEl) {
    if (!panelEl) throw new Error('Nie znaleziono panelu');


    const titleBlock = panelEl.querySelector('.title-block-1');
    const playerLink = titleBlock?.querySelector('a[href^="player/"]');
    const ageMatch = titleBlock?.textContent.match(/wiek:\s*(\d+)/);


    const clubLink = panelEl.querySelector('a[href^="app/team/"]');
    const countryLink = panelEl.querySelector('a[href^="country/ID_country/"]');

    const valueSpan = [...panelEl.querySelectorAll('span.text-success')]
        .find(s => s.textContent.includes('zł'));

    const wageMatch = panelEl.innerText.match(/wynagrodzenie:\s*([\d\s]+) zł/);

    const physMatch = panelEl.innerText.match(
        /wzrost:\s*(\d+).*?cm.*,?\s*waga:\s*([\d.]+).*?kg.*,?\s*BMI:\s*([\d.]+)/
    );


    const liNodes = [...panelEl.querySelectorAll('ul.list-unstyled li')];
    const formLi = liNodes.find(li => li.textContent.includes('forma'));
    const discLi = liNodes.find(li => li.textContent.includes('dyscyplina taktyczna'));

    const getSkillInfo = (li) => {
        if (!li) return null;
        const levelLabel = li.querySelector('span')?.childNodes[0]?.textContent.trim();
        const number = li.querySelector('.skillNameNumber')?.textContent.replace(/\[|\]/g, '');
        return {levelLabel, number: Number(number)};
    };


    const skillsNumbers = [];
    panelEl.querySelectorAll('table.table-skills .skillNameNumber').forEach(span => {
        const numberText = span.textContent.replace(/\[|\]/g, '');
        const number = parseInt(numberText, 10);
        if (!isNaN(number)) {
            skillsNumbers.push(number);
        }
    });


    return {
        name: playerLink?.textContent.trim() ?? null,
        profileUrl: playerLink?.href ?? null,
        age: ageMatch ? Number(ageMatch[1]) : null,

        club: clubLink ? {
            name: clubLink.textContent.trim(),
            url: clubLink.href
        } : null,

        country: countryLink ? {
            name: countryLink.textContent.trim(),
            url: countryLink.href
        } : null,

        value: valueSpan ? valueSpan.textContent.trim() : null,
        wage: wageMatch ? wageMatch[1].replace(/\s/g, '') : null,

        form: getSkillInfo(formLi),
        tacticalDiscipline: getSkillInfo(discLi),

        heightCm: physMatch ? Number(physMatch[1]) : null,
        weightKg: physMatch ? Number(physMatch[2]) : null,
        bmi: physMatch ? Number(physMatch[3]) : null,

        skills: skillsNumbers
    };
}

const skills = {
    0: "tragiczny",
    1: "beznadziejny",
    2: "niedostateczny",
    3: "mierny",
    4: "słaby",
    5: "przeciętny",
    6: "dostateczny",
    7: "dobry",
    8: "solidny",
    9: "bardzo dobry",
    10: "celujący",
    11: "świetny",
    12: "znakomity",
    13: "niesamowity",
    14: "olśniewający",
    15: "magiczny",
    16: "nieziemski",
    17: "boski",
    18: "nadboski"
};