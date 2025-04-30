

function fillRow(rowId, dataObj) {
    Object.entries(dataObj).forEach(([key, val]) => {
        const cell = document.querySelector(`#${rowId} td[data-key="${key}"]`);
        if (cell) cell.textContent = val;
    });
}

function highlightHigher(keys) {
    keys.forEach(key => {
        const cell1 = document.querySelector(`#row-1 td[data-key="${key}"]`);
        const cell2 = document.querySelector(`#row-2 td[data-key="${key}"]`);

        cell1.classList.remove('text-success', 'strong');
        cell2.classList.remove('text-success', 'strong');

        const v1 = parseFloat(cell1.textContent) || 0;
        const v2 = parseFloat(cell2.textContent) || 0;

        if (v1 > v2)       cell1.classList.add('text-success', 'strong');
        else if (v2 > v1)  cell2.classList.add('text-success', 'strong');
    });
}

async function getSimilarTransfers(playerData, week = 13, season = 0) {

    try {
        const age = playerData.age;
        const [stamina, keeper, pace, defender, technique, playmaker, passing, striker] = playerData.skills;
        const url = playerData.profileUrl;
        const parts = url.split('/');
        const pid = parts.pop();

        let query = '';

        if (season === 0) {
            query = `
                SELECT *
                FROM transfers_with_sumskills_pln
                WHERE price_pln IS NOT NULL
                  AND pid != ${pid}
                  AND season = (SELECT MAX (season) FROM transfers_with_sumskills_pln)
                  AND week <= ${week}
            `;
        } else {
            query = `
                SELECT *
                FROM transfers_with_sumskills_pln
                WHERE price_pln IS NOT NULL
                  AND pid != ${pid}
                  AND season >= ${season}
                  AND week <= ${week}
            `;
        }



        const res = await runSQL(query);

        if (!res || !res.values) {
            return [];
        }

        let weekListQuery;

        if (season === 0) {
            weekListQuery = await runSQL(`
        SELECT DISTINCT week
        FROM transfers
        WHERE season = (SELECT MAX(season) FROM transfers_with_sumskills_pln)
        ORDER BY week ASC
    `);
        } else {
            weekListQuery = await runSQL(`
        SELECT DISTINCT week
        FROM transfers
        WHERE season >= ${season}
        ORDER BY week ASC
    `);
        }

        const weekList = weekListQuery.values.map(row => row[0]);

        const seasonListQuery = await runSQL(`SELECT DISTINCT season FROM transfers ORDER BY season ASC`);
        const seasonList = seasonListQuery.values.map(row => row[0]);

        const transfers = res.values.map(row => {
            const transfer = {};
            res.columns.forEach((col, idx) => {
                transfer[col] = row[idx];
            });
            return transfer;
        });


        const similarTransfers = transfers.map(transfer => {
            const distance = Math.sqrt(
                Math.pow((transfer.stam ?? 0) - (stamina ?? 0), 2) +
                Math.pow((transfer.gk ?? 0) - (keeper ?? 0), 2) +
                Math.pow((transfer.pace ?? 0) - (pace ?? 0), 2) +
                Math.pow((transfer.def ?? 0) - (defender ?? 0), 2) +
                Math.pow((transfer.tech ?? 0) - (technique ?? 0), 2) +
                Math.pow((transfer.play ?? 0) - (playmaker ?? 0), 2) +
                Math.pow((transfer.pass ?? 0) - (passing ?? 0), 2) +
                Math.pow((transfer.str ?? 0) - (striker ?? 0), 2) +
                Math.pow((transfer.age ?? 0) - (age ?? 0), 2)
            );
            return {transfer, distance};
        });

        similarTransfers.sort((a, b) => a.distance - b.distance);
        return [similarTransfers.slice(0, 10), seasonList, weekList];
    } catch (err) {
        return [];
    }
}

function formatCurrency(amount, currency = 'PLN', locale = 'pl-PL') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0
    }).format(amount);
}


function render(transfers, week, season) {
    [transfers, seasonList, weekList] = transfers;
    const weekOptionsHTML = weekList.map(w => {
        const selected = (parseInt(w) === parseInt(week)) ? 'selected' : '';
        return `<option value=${w} ${selected}>${w}</option>`;
    }).join('');

    const seasonOptionsHTML = seasonList.map(s => {
        const selected = (parseInt(s) === parseInt(season)) ? 'selected' : '';
        console.log(s, season, selected);
        return `<option value=${s} ${selected}>${s}</option>`;
    }).join('');

    const similarTransferPanel = document.getElementById('similar-transfer');
    if (similarTransferPanel) {
        similarTransferPanel.remove();
    }

    const similarTransferCharPanel = document.getElementById('similar-transfer-char');
    if (similarTransferCharPanel) {
        similarTransferCharPanel.remove();
    }


    if (transfers && transfers.length > 0) {
        const rowElement = document.querySelector(".row");
        const allCol = rowElement.querySelectorAll(".col-md-6.col-sm-12.col-xs-12");
        const lastCol = allCol[allCol.length - 1];

        const panelElement = document.createElement("div");
        panelElement.classList.add("panel", "panel-default");
        panelElement.id = "similar-transfer";
        const panelElementHeadList = document.createElement("div");

        panelElementHeadList.classList.add("panel-heading");
        panelElementHeadList.innerHTML = `
  <div class="h5 title-block-1 mb-3">Similar transfers</div>
    
   <table class="table-condensed">
       <thead>
       <tr>
       <th>From Season</th>
       <th>To week</th>
    </tr>
    </thead>
    <tbody>
    <tr>
    <td><select id="transfer-filter-season" class="form-control">
       ${seasonOptionsHTML}
      </select></td>
    <td><select id="transfer-filter-week" class="form-control">
        ${weekOptionsHTML}
      </select></td>
</tr>
</tbody>

</table>
`;

        const panelBody = document.createElement("div");
        panelBody.classList.add("panel-body");

        const tableElement = document.createElement("table");
        tableElement.classList.add("table", "table-condensed", "table-skills");

        tableElement.innerHTML = `
                <thead>
                    <tr>
                        <th>Pid</th>
                        <th>Distance</th>
                        <th>Age</th>
                        <th>Overall</th>
                        <th>Value</th>
                        <th>Transfer Date</th>
                        <th>Season</th>
                        <th>Weak</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            `;

        const tbody = tableElement.querySelector("tbody");

        transfers.forEach(element => {
            const transfer = element.transfer;
            const distance = element.distance.toFixed(3);

            let formattedDate = '-';
            if (transfer.transfer_date && transfer.tr_time) {
                formattedDate = `${transfer.transfer_date} ${transfer.tr_time}`;
            }

            const formattedValue = transfer.price_pln
                ? formatCurrency(transfer.price_pln)
                : '-';

            const tooltipText = `
                        defSS: ${transfer.defSS ?? '-'}
                        defSides: ${transfer.defSides ?? '-'}
                        midSS: ${transfer.midSS ?? '-'}
                        wingSS: ${transfer.wingSS ?? '-'}
                        attSS: ${transfer.attSS ?? '-'}
                        attSides: ${transfer.attSides ?? '-'}
                        all_skills: ${transfer.all_skills ?? '-'}
                        tact_disc: ${transfer.tact_disc ?? '-'}
                        `.trim().replace(/\n/g, ' | ');


            const tr = document.createElement("tr");
            tr.title = tooltipText;
            tr.innerHTML = `
                    <td>${transfer.pid}</td>
                    <td>${distance}</td>
                    <td>${transfer.age}</td>
                    <td>${transfer.all_skills}</td>
                    <td>${formattedValue}</td>
                    <td>${formattedDate}</td>
                    <td>${transfer.season}</td>
                    <td>${transfer.week}</td>
                `;

            tr.addEventListener("click", () => {
                handleClick(transfer, playerData, allCol);
            });

            tbody.appendChild(tr);
        });

        const panelElementChar = document.createElement("div");
        panelElementChar.classList.add("panel", "panel-default");
        panelElementChar.id = "similar-transfer-char";
        panelElementChar.style.display = "none";

        const panelElementHead = document.createElement("div");
        panelElementHead.classList.add("panel-heading");
        panelElementHead.innerHTML = `<div class="h5 title-block-1">Similar Char</div>
                <table id="skills-table" class = "table table-condensed table-skills">
                  <thead>
                    <tr>
                      <th></th>
                      <th>defSS</th>
                      <th>defSides</th>
                      <th>midSS</th>
                      <th>wingSS</th>
                      <th>attSS</th>
                      <th>attSides</th>
                      <th>overall</th>
                    </tr>
                  </thead>
                
                  <tbody>
                     <tr id="row-1">
                     <td>My</td>
                      <td data-key="defSS"></td>
                      <td data-key="defSides"></td>
                      <td data-key="midSS"></td>
                      <td data-key="wingSS"></td>
                      <td data-key="attSS"></td>
                      <td data-key="attSides"></td>
                      <td data-key="all_skills"></td>
                    </tr>
               
                    <tr id="row-2">
                      <td>Similar</td>
                      <td data-key="defSS"></td>
                      <td data-key="defSides"></td>
                      <td data-key="midSS"></td>
                      <td data-key="wingSS"></td>
                      <td data-key="attSS"></td>
                      <td data-key="attSides"></td>
                      <td data-key="all_skills"></td>
                    </tr>
                  </tbody>
                </table>
                `

        const panelBodyChar = document.createElement("div");
        panelBodyChar.classList.add("panel-body");
        panelBodyChar.style.textAlign = "center";
        panelBodyChar.innerHTML = `<canvas id="similar_chart"></canvas>`;

        panelBody.appendChild(tableElement);
        panelElement.appendChild(panelElementHeadList);
        panelElement.appendChild(panelBody);

        lastCol.appendChild(panelElement);

        panelElementChar.appendChild(panelElementHead);
        panelElementChar.appendChild(panelBodyChar);
        lastCol.appendChild(panelElementChar);

        const transferFilterWeek = document.getElementById('transfer-filter-week');
        const transferFilterSeason = document.getElementById('transfer-filter-season');

        let selectedWeek = 13;
        let selectedSeason = 0;

        if (transferFilterWeek && transferFilterWeek.value) {
            selectedWeek = Number(transferFilterWeek.value);
        }

        if (transferFilterSeason && transferFilterSeason.value) {
            selectedSeason = Number(transferFilterSeason.value);
        }

        if (transferFilterWeek) {
            transferFilterWeek.addEventListener('change', async () => {
                selectedWeek = Number(transferFilterWeek.value);
                const newTransfers = await getSimilarTransfers(playerData, selectedWeek, selectedSeason);
                render(newTransfers, selectedWeek, selectedSeason);
            });
        } else {
            console.error('Element select "transfer-filter-week" not found.');
        }

        if (transferFilterSeason) {
            transferFilterSeason.addEventListener('change', async () => {
                selectedSeason = Number(transferFilterSeason.value);
                const newTransfers = await getSimilarTransfers(playerData, selectedWeek, selectedSeason);
                render(newTransfers, selectedWeek, selectedSeason);
            });
        } else {
            console.error('Element select "transfer-filter-season" not found.');
        }
    }
}

function handleClick(transfer, orginal_player_skills, allCol) {
    const firstColt = allCol[0]

    if (firstColt.querySelector(".similar-transfer")) {
        firstColt.querySelector(".similar-transfer").remove();
    }


    const newPanel = document.createElement("div");
    newPanel.classList.add("panel", "panel-default", "similar-transfer");

    const panelBody = document.createElement("div");
    panelBody.classList.add("panel-body", "hidden-xs");

    const formattedValue = formatCurrency(transfer.value_pln);
    const formattedWage = formatCurrency(transfer.wage_pln);

    panelBody.innerHTML = `
    <div class="media">
        <div class="media-body">
        <ul class="list-unstyled list-underline">
        <li>wartość: ${formattedValue}</li>
        <li>wynagrodzenie: ${formattedWage}</li>
        <li>&nbsp;</li>
</li>
</ul>
        </div>
</div> `;

    const tableElement = document.createElement("table");
    tableElement.classList.add("table", "table-condensed", "table-skills");

    tableElement.innerHTML = `
                <tbody>
                </tbody>
            `;

    const tbody = tableElement.querySelector("tbody");
    const tr1 = document.createElement("tr");
    const tr2 = document.createElement("tr");
    const tr3 = document.createElement("tr");
    const tr4 = document.createElement("tr");

    tr1.innerHTML = `
    <td><strong class="">${skills[transfer.stam]} <span class="skillNameNumber">[${transfer.stam}]</span></strong> kondycja</td>
    <td><strong class="">${skills[transfer.gk]} <span class="skillNameNumber">[${transfer.gk}]</span></strong> bramkarz</td>
    `;
    tbody.appendChild(tr1);
    tr2.innerHTML = `
    <td><strong class="">${skills[transfer.pace]} <span class="skillNameNumber">[${transfer.pace}]</span></strong> szybkość</td>
    <td><strong class="">${skills[transfer.def]} <span class="skillNameNumber">[${transfer.def}]</span></strong> obrońca</td>
    `;
    tbody.appendChild(tr2);
    tr3.innerHTML = `
    <td><strong class="">${skills[transfer.tech]} <span class="skillNameNumber">[${transfer.tech}]</span></strong> technika</td>
    <td><strong class="">${skills[transfer.play]} <span class="skillNameNumber">[${transfer.play}]</span></strong> rozgrywający</td>
    `;
    tbody.appendChild(tr3);
    tr4.innerHTML = `
    <td><strong class="">${skills[transfer.pass]} <span class="skillNameNumber">[${transfer.pass}]</span></strong> podania</td>
    <td><strong class="">${skills[transfer.str]} <span class="skillNameNumber">[${transfer.str}]</span></strong> strzelec</td>
    `;
    tbody.appendChild(tr4);
    panelBody.appendChild(tableElement);

    const panelHeading = document.createElement("div");
    panelHeading.classList.add("panel-heading");


    panelHeading.innerHTML = `<div class="h5 title-block-1"><a class="" href="/player/PID/${transfer.pid}">${transfer.name}</a>, wiek <strong>${transfer.age}</strong></div>`

    newPanel.appendChild(panelHeading);
    newPanel.appendChild(panelBody);
    firstColt.appendChild(newPanel);

    if (orginal_player_skills.skills != null) {
        const row1Data = {
            defSS      : orginal_player_skills.skills[2] + orginal_player_skills.skills[3],
            defSides   : orginal_player_skills.skills[4] + orginal_player_skills.skills[5] + orginal_player_skills.skills[6],
            midSS      : orginal_player_skills.skills[2] + orginal_player_skills.skills[3] + orginal_player_skills.skills[4] + orginal_player_skills.skills[5] + orginal_player_skills.skills[6],
            wingSS     : orginal_player_skills.skills[2] + orginal_player_skills.skills[4] + orginal_player_skills.skills[5] + orginal_player_skills.skills[6],
            attSS      : orginal_player_skills.skills[2] + orginal_player_skills.skills[4] + orginal_player_skills.skills[7],
            attSides   : orginal_player_skills.skills[3] + orginal_player_skills.skills[5] + orginal_player_skills.skills[6],
            all_skills : orginal_player_skills.skills.reduce((sum, value) => sum + Number(value), 0)
        };

        const row2Data = {
            defSS      : transfer.defSS,
            defSides   : transfer.defSides,
            midSS      : transfer.midSS,
            wingSS     : transfer.wingSS,
            attSS      : transfer.attSS,
            attSides   : transfer.attSides,
            all_skills : transfer.all_skills
        };

        fillRow('row-1', row1Data);
        fillRow('row-2', row2Data);
        highlightHigher(Object.keys(row1Data));


        document.getElementById('similar-transfer-char').style.display = "block";
        const canvas = document.getElementById('similar_chart');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        canvas.width = 600;
        canvas.height = 500;

        const labels = [
            "Obrońca",
            "Bramkarz",
            "Szybkość",
            "Podania",
            "Rozgrywający",
            "Strzelec",
            "Technika"
        ];

        const data = [
            transfer.def,
            transfer.gk,
            transfer.pace,
            transfer.pass,
            transfer.play,
            transfer.str,
            transfer.tech
        ];

        const orginal_data = [
            orginal_player_skills.skills[3],
            orginal_player_skills.skills[1],
            orginal_player_skills.skills[2],
            orginal_player_skills.skills[6],
            orginal_player_skills.skills[5],
            orginal_player_skills.skills[7],
            orginal_player_skills.skills[4]
        ]

        const combinedData = [...data, ...orginal_data];
        const maxValue = Math.max(...combinedData);


        const padding = 50; // Padding od krawędzi płótna
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) / 2 - padding;


        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;

        for (let i = 1; i <= maxValue; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, (radius / maxValue) * i, 0, Math.PI * 2);
            ctx.stroke();
        }

        labels.forEach((label, index) => {
            const angle = (Math.PI * 2 / labels.length) * index - Math.PI / 2;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '16px Nunito Sans';
            ctx.fillText(
                label,
                centerX + (radius + 40) * Math.cos(angle),
                centerY + (radius + 20) * Math.sin(angle)
            );
        });


        ctx.strokeStyle = 'rgb(255, 99, 132)';
        ctx.fillStyle = 'rgba(255, 99, 132, 0.2)';
        ctx.beginPath();

        data.forEach((value, index) => {
            const angle = (Math.PI * 2 / labels.length) * index - Math.PI / 2;
            const x = centerX + (value / maxValue) * radius * Math.cos(angle);
            const y = centerY + (value / maxValue) * radius * Math.sin(angle);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            ctx.fillText(
                value,
                x,
                y - 10
            );

        });

        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgb(54, 162, 235)';
        ctx.fillStyle = 'rgba(54, 162, 235, 0.2)';
        ctx.beginPath();

        orginal_data.forEach((value, index) => {
            const angle = (Math.PI * 2 / labels.length) * index - Math.PI / 2;
            const x = centerX + (value / maxValue) * radius * Math.cos(angle);
            const y = centerY + (value / maxValue) * radius * Math.sin(angle);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            ctx.fillText(
                value,
                x,
                y - 10
            );

        });

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

window.runSQL = runSQL;


const panel = document.querySelector('.panel.panel-default');

const playerData = extractPlayerData(panel);

if (playerData.skills.length !== 0) {

    getSimilarTransfers(playerData)
        .then(transfers => {
            render(transfers, Math.max(...transfers[2]), Math.max(...transfers[1]));
        })
        .catch(err => {
            console.error('Błąd w getSimilarTransfers:', err);
        });
}

