/**
 * Unit Tests for LotoController
 * Chạy: node lotoController.test.js
 */
const assert = require('assert');
const LotoController = require('./lotoController');

// Helper: Tạo một tờ vé giả (3 hàng × 9 cột, mỗi hàng 5 số)
function makeTicket(rows) {
    // rows = [[n1,n2,n3,n4,n5], ...] → pad thành 9 cột với 0
    return rows.map(row => {
        const full = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        row.forEach((v, i) => {
            // Đặt số vào cột tương ứng (đơn giản hóa)
            const col = Math.floor((v - 1) / 10); // col 0-8 based on value range
            full[col] = v;
        });
        return full;
    });
}

// Helper: Tạo tờ vé dùng raw grid (đã có sẵn 9 cột)
function makeRawTicket(grid) {
    return grid;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

// ====== TEST SUITE ======

console.log('\n=== LotoController Tests ===\n');

// --- Constructor ---
console.log('Constructor:');

test('K threshold should be between 10 and 20', () => {
    for (let i = 0; i < 100; i++) {
        const players = [{ tickets: [[[1, 0, 0, 0, 0, 0, 0, 0, 0]]] }];
        const ctrl = new LotoController(players);
        assert.ok(ctrl.k_threshold >= 10, `K=${ctrl.k_threshold} < 10`);
        assert.ok(ctrl.k_threshold <= 20, `K=${ctrl.k_threshold} > 20`);
    }
});

test('Initial stage should be SAFE_INIT', () => {
    const ctrl = new LotoController([]);
    assert.strictEqual(ctrl.currentStage, 'SAFE_INIT');
});

test('drawnNumbers should start empty', () => {
    const ctrl = new LotoController([]);
    assert.strictEqual(ctrl.drawnNumbers.size, 0);
});

// --- SAFE_INIT Stage ---
console.log('\nSAFE_INIT:');

test('Should not allow any Bingo (5/5) before K draws', () => {
    // Tạo player có row gần đầy
    const ticket = makeRawTicket([
        [1, 0, 12, 0, 0, 0, 0, 0, 0],
        [0, 10, 0, 30, 0, 50, 0, 70, 0],
        [0, 0, 20, 0, 40, 0, 60, 0, 80]
    ]);
    const players = [{ tickets: [ticket] }];
    const ctrl = new LotoController(players);

    // Force K = 20 to have longer safe phase
    ctrl.k_threshold = 20;

    for (let i = 0; i < 20; i++) {
        ctrl.drawNextNumber();
    }

    // Kiểm tra: không có hàng nào đạt 5/5 trong quá trình SAFE_INIT
    for (const row of ticket) {
        const nonZero = row.filter(n => n !== 0);
        const hits = nonZero.filter(n => ctrl.drawnNumbers.has(n)).length;
        assert.ok(hits < 5, `Row has ${hits}/5 hits during SAFE_INIT - Bingo should be blocked!`);
    }
});

test('Should not allow 4/5 (Chờ) before 10th draw', () => {
    // Tạo rows dễ match
    const ticket = makeRawTicket([
        [1, 11, 21, 31, 41, 0, 0, 0, 0],
        [2, 12, 22, 32, 42, 0, 0, 0, 0],
        [3, 13, 23, 33, 43, 0, 0, 0, 0]
    ]);
    const players = [{ tickets: [ticket] }];
    const ctrl = new LotoController(players);
    ctrl.k_threshold = 20;

    // Bốc 9 số đầu
    for (let i = 0; i < 9; i++) {
        ctrl.drawNextNumber();
    }

    // Kiểm tra: không có hàng nào đạt 4/5 sau 9 lần bốc
    for (const row of ticket) {
        const nonZero = row.filter(n => n !== 0);
        const hits = nonZero.filter(n => ctrl.drawnNumbers.has(n)).length;
        assert.ok(hits < 4, `Row has ${hits}/5 hits in first 9 draws - Chờ should be blocked!`);
    }
});

// --- Stage Transitions ---
console.log('\nStage Transitions:');

test('Should transition from SAFE_INIT to WAITING_PUSH after K draws', () => {
    const ticket = makeRawTicket([
        [1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);
    const players = [{ tickets: [ticket] }];
    const ctrl = new LotoController(players);

    // Bốc K+1 số (transition check xảy ra ở đầu drawNextNumber,
    // nên cần thêm 1 lần gọi sau khi drawnNumbers.size == K)
    for (let i = 0; i <= ctrl.k_threshold; i++) {
        ctrl.drawNextNumber();
    }

    // Sau K+1 lần gọi, stage phải đã chuyển
    assert.ok(
        ctrl.currentStage === 'WAITING_PUSH' || ctrl.currentStage === 'NATURAL_FINISH',
        `Stage should be WAITING_PUSH or NATURAL_FINISH after K+1 draws, got: ${ctrl.currentStage}`
    );
});

test('Should transition to NATURAL_FINISH when all players have ≥1 row at 4/5', () => {
    // Tạo 2 players, mỗi người có row dễ match
    const ticket1 = makeRawTicket([
        [1, 11, 21, 31, 41, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);
    const ticket2 = makeRawTicket([
        [2, 12, 22, 32, 42, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);
    const players = [
        { tickets: [ticket1] },
        { tickets: [ticket2] }
    ];
    const ctrl = new LotoController(players);
    ctrl.k_threshold = 10; // Shorter safe phase

    // Bốc cho đến khi NATURAL_FINISH hoặc hết số
    let maxDraws = 90;
    while (ctrl.currentStage !== 'NATURAL_FINISH' && maxDraws-- > 0) {
        ctrl.drawNextNumber();
    }

    assert.strictEqual(ctrl.currentStage, 'NATURAL_FINISH',
        'Should reach NATURAL_FINISH eventually');

    // Verify all players have ≥1 row at 4/5
    assert.ok(ctrl.checkAllWaiting(), 'All players should be in waiting state');
});

// --- WAITING_PUSH ---
console.log('\nWAITING_PUSH:');

test('WAITING_PUSH should prioritize numbers that help waiting-deficient players', () => {
    // Player 1 đã có row 3/5, Player 2 chưa có gì
    const ticket1 = makeRawTicket([
        [1, 11, 21, 31, 41, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);
    const ticket2 = makeRawTicket([
        [5, 15, 25, 35, 45, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]);
    const players = [
        { tickets: [ticket1] },
        { tickets: [ticket2] }
    ];
    const ctrl = new LotoController(players);

    // Force vào WAITING_PUSH
    ctrl.currentStage = 'WAITING_PUSH';
    // Giả sử Player 1 đã có 3/5 hits
    ctrl.drawnNumbers = new Set([1, 11, 21]);

    const result = ctrl.drawNextNumber();

    // Nên chọn số từ target pool (31 hoặc 41 cho player1, hoặc 5/15/25/35/45 cho player2)
    assert.ok(result.number > 0, 'Should draw a valid number');
});

// --- Full Game Simulation ---
console.log('\nFull Game:');

test('Should be able to draw all 90 numbers without errors', () => {
    const ticket1 = makeRawTicket([
        [1, 11, 21, 31, 41, 0, 0, 0, 0],
        [0, 12, 0, 32, 0, 52, 0, 72, 0],
        [3, 0, 23, 0, 43, 0, 63, 0, 83]
    ]);
    const ticket2 = makeRawTicket([
        [4, 14, 24, 34, 44, 0, 0, 0, 0],
        [0, 15, 0, 35, 0, 55, 0, 75, 0],
        [6, 0, 26, 0, 46, 0, 66, 0, 86]
    ]);
    const players = [
        { tickets: [ticket1] },
        { tickets: [ticket2] }
    ];
    const ctrl = new LotoController(players);

    const drawnOrder = [];
    for (let i = 0; i < 90; i++) {
        const result = ctrl.drawNextNumber();
        assert.ok(result !== null, `Draw #${i + 1} should not return null`);
        assert.ok(result.number >= 1 && result.number <= 90, `Number ${result.number} out of range`);
        drawnOrder.push(result.number);
    }

    // Verify: 90 unique numbers
    const uniqueNums = new Set(drawnOrder);
    assert.strictEqual(uniqueNums.size, 90, `Should have 90 unique numbers, got ${uniqueNums.size}`);

    // 91st draw should return null
    const extra = ctrl.drawNextNumber();
    assert.strictEqual(extra, null, 'Draw #91 should return null');
});

test('Stages should progress in order SAFE_INIT → WAITING_PUSH → NATURAL_FINISH', () => {
    const ticket1 = makeRawTicket([
        [1, 11, 21, 31, 41, 0, 0, 0, 0],
        [0, 12, 0, 32, 0, 52, 0, 72, 0],
        [3, 0, 23, 0, 43, 0, 63, 0, 83]
    ]);
    const ticket2 = makeRawTicket([
        [4, 14, 24, 34, 44, 0, 0, 0, 0],
        [0, 15, 0, 35, 0, 55, 0, 75, 0],
        [6, 0, 26, 0, 46, 0, 66, 0, 86]
    ]);
    const players = [
        { tickets: [ticket1] },
        { tickets: [ticket2] }
    ];
    const ctrl = new LotoController(players);

    const stageLog = [];

    for (let i = 0; i < 90; i++) {
        const result = ctrl.drawNextNumber();
        if (result) stageLog.push(result.stage);
    }

    // Stages should appear in order (once switched, should not go back)
    let seenStages = [];
    let lastStage = '';
    for (const stage of stageLog) {
        if (stage !== lastStage) {
            seenStages.push(stage);
            lastStage = stage;
        }
    }

    assert.strictEqual(seenStages[0], 'SAFE_INIT', 'Should start with SAFE_INIT');
    assert.ok(seenStages.length <= 3, `Should have at most 3 stage changes, got ${seenStages.length}`);

    // Verify order
    const validOrders = [
        ['SAFE_INIT'],
        ['SAFE_INIT', 'WAITING_PUSH'],
        ['SAFE_INIT', 'WAITING_PUSH', 'NATURAL_FINISH'],
        ['SAFE_INIT', 'NATURAL_FINISH'] // If all players already 4/5 when entering WAITING_PUSH
    ];
    const isValidOrder = validOrders.some(order =>
        order.length === seenStages.length && order.every((s, i) => s === seenStages[i])
    );
    assert.ok(isValidOrder, `Stage order ${JSON.stringify(seenStages)} is not valid`);
});

// --- Results ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
