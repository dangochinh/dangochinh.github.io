/**
 * Simulation: 10 players - output sang JSON file
 */
const fs = require('fs');
const LotoController = require('./lotoController');
const { getAllTicketSets } = require('./utils/ticketGenerator');

const allSets = getAllTicketSets();
const players = allSets.slice(0, 16).map((set, i) => ({
    name: `Player_${i + 1} (${set.name})`,
    tickets: set.data
}));

const NUM_SIMULATIONS = 5;
const results = [];

for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
    const ctrl = new LotoController(players);
    const simResult = {
        sim: sim + 1,
        k_threshold: ctrl.k_threshold,
        stageTransitions: [],
        violations: [],
        finalStage: '',
        totalDrawn: 0,
        playersWaiting: 0,
        playersBingo: 0,
        allWaiting: false,
        passed: false
    };

    let lastStage = '';
    for (let draw = 0; draw < 90; draw++) {
        const result = ctrl.drawNextNumber();
        if (!result) break;

        if (result.stage !== lastStage) {
            simResult.stageTransitions.push({
                from: lastStage || 'START',
                to: result.stage,
                atDraw: result.totalDrawn
            });
            lastStage = result.stage;
        }

        // Check violations during SAFE_INIT
        if (draw < ctrl.k_threshold) {
            for (const player of players) {
                for (const ticket of player.tickets) {
                    for (const row of ticket) {
                        const nonZero = row.filter(n => n !== 0);
                        const hits = nonZero.filter(n => ctrl.drawnNumbers.has(n)).length;
                        if (hits >= 5) {
                            simResult.violations.push(`Bingo at draw #${result.totalDrawn} for ${player.name}`);
                        }
                        if (result.totalDrawn <= 10 && hits >= 4) {
                            simResult.violations.push(`Cho at draw #${result.totalDrawn} for ${player.name}`);
                        }
                    }
                }
            }
        }
    }

    simResult.finalStage = ctrl.currentStage;
    simResult.totalDrawn = ctrl.drawnNumbers.size;
    simResult.allWaiting = ctrl.checkAllWaiting();

    let waitingCount = 0, bingoCount = 0;
    for (const player of players) {
        let hasW = false, hasB = false;
        for (const ticket of player.tickets) {
            for (const row of ticket) {
                const nonZero = row.filter(n => n !== 0);
                const hits = nonZero.filter(n => ctrl.drawnNumbers.has(n)).length;
                if (hits >= 4) hasW = true;
                if (hits >= 5) hasB = true;
            }
        }
        if (hasW) waitingCount++;
        if (hasB) bingoCount++;
    }
    simResult.playersWaiting = waitingCount;
    simResult.playersBingo = bingoCount;
    simResult.passed = simResult.violations.length === 0
        && simResult.finalStage === 'NATURAL_FINISH'
        && simResult.allWaiting;

    results.push(simResult);
}

fs.writeFileSync('simulation_result.json', JSON.stringify(results, null, 2), 'utf8');
console.log('Done - see simulation_result.json');
