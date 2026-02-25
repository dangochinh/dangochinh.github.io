import { Player } from '../types';

type DrawStage = 'SAFE_INIT' | 'WAITING_PUSH' | 'NATURAL_FINISH';

export interface DrawResult {
    number: number;
    stage: DrawStage;
    totalDrawn: number;
}

/**
 * LotoController - Thuật toán Điều tiết Loto Kịch tính
 *
 * 3 giai đoạn:
 *  1. SAFE_INIT     : Bốc K số đầu tiên (K ∈ [10,20]) an toàn, chặn Bingo/Chờ sớm
 *  2. WAITING_PUSH  : Đẩy tất cả người chơi vào thế chờ (≥1 hàng 4/5)
 *  3. NATURAL_FINISH: Xổ random 100%
 */
export class LotoController {
    private players: Player[];
    private drawnNumbers: Set<number>;
    private allNumbers: number[];
    public currentStage: DrawStage;
    public k_threshold: number;

    constructor(players: Player[]) {
        this.players = players;
        this.drawnNumbers = new Set();
        this.allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
        this.currentStage = 'SAFE_INIT';
        this.k_threshold = Math.floor(Math.random() * 11) + 10; // K ∈ [10, 20]
    }

    /** Đếm số hit trong một hàng */
    private getRowStatus(row: number[]): { hits: number; total: number } {
        const nonZero = row.filter(num => num !== 0);
        const hits = nonZero.filter(num => this.drawnNumbers.has(num)).length;
        return { hits, total: nonZero.length };
    }

    /** Kiểm tra TẤT CẢ người chơi đã có ít nhất 1 hàng đạt 4/5 */
    private checkAllWaiting(): boolean {
        return this.players.every(player => {
            if (!player.tickets || !Array.isArray(player.tickets)) return false;
            return player.tickets.some(ticket =>
                ticket.some(row => this.getRowStatus(row).hits >= 4)
            );
        });
    }

    /**
     * Bốc số tiếp theo (logic ngầm)
     * Trả về null nếu hết số
     */
    drawNextNumber(): DrawResult | null {
        const remainingNumbers = this.allNumbers.filter(n => !this.drawnNumbers.has(n));
        if (remainingNumbers.length === 0) return null;

        // Stage Transition
        if (this.currentStage === 'SAFE_INIT' && this.drawnNumbers.size >= this.k_threshold) {
            this.currentStage = 'WAITING_PUSH';
        }
        if (this.currentStage === 'WAITING_PUSH' && this.checkAllWaiting()) {
            this.currentStage = 'NATURAL_FINISH';
        }

        let candidate: number;

        if (this.currentStage === 'SAFE_INIT') {
            candidate = this.drawSafeInit(remainingNumbers);
        } else if (this.currentStage === 'WAITING_PUSH') {
            candidate = this.drawWaitingPush(remainingNumbers);
        } else {
            candidate = remainingNumbers[Math.floor(Math.random() * remainingNumbers.length)];
        }

        this.drawnNumbers.add(candidate);
        return {
            number: candidate,
            stage: this.currentStage,
            totalDrawn: this.drawnNumbers.size
        };
    }

    /**
     * GIAI ĐOẠN 1: Bốc an toàn
     * - Trước số 10: chặn 4/5 và 5/5
     * - Từ 10 đến K: chỉ chặn 5/5
     */
    private drawSafeInit(remaining: number[]): number {
        const pool = [...remaining];

        while (pool.length > 0) {
            const idx = Math.floor(Math.random() * pool.length);
            const val = pool.splice(idx, 1)[0];
            let isViolated = false;

            for (const player of this.players) {
                if (!player.tickets) continue;
                for (const ticket of player.tickets) {
                    for (const row of ticket) {
                        const { hits } = this.getRowStatus(row);
                        const isInRow = row.includes(val);
                        if (!isInRow) continue;

                        // Chặn Bingo (5/5)
                        if (hits === 4) { isViolated = true; break; }
                        // Chặn Chờ (4/5) trước số thứ 10
                        if (this.drawnNumbers.size < 10 && hits === 3) { isViolated = true; break; }
                    }
                    if (isViolated) break;
                }
                if (isViolated) break;
            }

            if (!isViolated) return val;
        }

        return remaining[0]; // Fallback
    }

    /**
     * GIAI ĐOẠN 2: Đẩy mọi người vào thế chờ (4/5)
     * Bắt buộc chạy đến khi 100% có ≥1 hàng 4/5
     */
    private drawWaitingPush(remaining: number[]): number {
        const notWaitingPlayers = this.players.filter(player => {
            if (!player.tickets) return false;
            return !player.tickets.some(ticket =>
                ticket.some(row => this.getRowStatus(row).hits >= 4)
            );
        });

        const targetPool: number[] = [];

        // Ưu tiên 1: rows 3/5 → tìm số để lên 4/5
        for (const player of notWaitingPlayers) {
            if (!player.tickets) continue;
            for (const ticket of player.tickets) {
                for (const row of ticket) {
                    const { hits } = this.getRowStatus(row);
                    if (hits === 3) {
                        const missing = row.filter(n => n !== 0 && !this.drawnNumbers.has(n));
                        missing.forEach(n => { if (remaining.includes(n)) targetPool.push(n); });
                    }
                }
            }
        }

        // Ưu tiên 2: rows 2/5
        if (targetPool.length === 0) {
            for (const player of notWaitingPlayers) {
                if (!player.tickets) continue;
                for (const ticket of player.tickets) {
                    for (const row of ticket) {
                        const { hits } = this.getRowStatus(row);
                        if (hits === 2) {
                            const missing = row.filter(n => n !== 0 && !this.drawnNumbers.has(n));
                            missing.forEach(n => { if (remaining.includes(n)) targetPool.push(n); });
                        }
                    }
                }
            }
        }

        if (targetPool.length > 0) {
            const frequency: Record<number, number> = {};
            targetPool.forEach(n => { frequency[n] = (frequency[n] || 0) + 1; });
            const bestNumber = Object.keys(frequency)
                .sort((a, b) => frequency[Number(b)] - frequency[Number(a)])[0];
            return parseInt(bestNumber);
        }

        return remaining[Math.floor(Math.random() * remaining.length)];
    }
}
