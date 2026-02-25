/**
 * LotoController - Thuật toán Điều tiết Loto Kịch tính
 * 
 * 3 giai đoạn:
 *  1. SAFE_INIT    : Bốc K số đầu tiên (K ∈ [10,20]) một cách an toàn, chặn Bingo/Chờ sớm
 *  2. WAITING_PUSH : Đẩy tất cả người chơi vào thế chờ (≥1 hàng 4/5) trước khi chuyển sang giai đoạn 3
 *  3. NATURAL_FINISH: Xổ random 100% từ số còn lại
 */
class LotoController {
    /**
     * @param {Array} players - Danh sách người chơi, mỗi người có { tickets: number[][][] }
     *   tickets là mảng các tờ vé, mỗi tờ có 3 hàng × 9 cột, giá trị 0 = ô trống
     */
    constructor(players) {
        this.players = players;
        this.drawnNumbers = new Set();
        this.allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
        this.currentStage = 'SAFE_INIT';
        this.k_threshold = Math.floor(Math.random() * 11) + 10; // K ∈ [10, 20]
    }

    /**
     * Đếm số hit (đã bốc) trong một hàng
     * @param {number[]} row - Một hàng 9 phần tử (0 = trống)
     * @returns {{ hits: number, total: number }}
     */
    getRowStatus(row) {
        const nonZero = row.filter(num => num !== 0);
        const hits = nonZero.filter(num => this.drawnNumbers.has(num)).length;
        return { hits, total: nonZero.length };
    }

    /**
     * Kiểm tra xem TẤT CẢ người chơi đã có ít nhất 1 hàng đạt 4/5 chưa
     * @returns {boolean}
     */
    checkAllWaiting() {
        return this.players.every(player => {
            if (!player.tickets || !Array.isArray(player.tickets)) return false;
            // Duyệt qua tất cả tờ vé (tickets) của người chơi
            return player.tickets.some(ticket =>
                ticket.some(row => this.getRowStatus(row).hits >= 4)
            );
        });
    }

    /**
     * Bốc số tiếp theo (Backend logic ngầm)
     * UI chỉ nhận kết quả cuối cùng đã qua bộ lọc
     * @returns {{ number: number, stage: string, totalDrawn: number }}
     */
    drawNextNumber() {
        const remainingNumbers = this.allNumbers.filter(n => !this.drawnNumbers.has(n));
        if (remainingNumbers.length === 0) return null;

        // Cập nhật giai đoạn (Stage Transition)
        if (this.currentStage === 'SAFE_INIT' && this.drawnNumbers.size >= this.k_threshold) {
            this.currentStage = 'WAITING_PUSH';
        }
        if (this.currentStage === 'WAITING_PUSH' && this.checkAllWaiting()) {
            this.currentStage = 'NATURAL_FINISH';
        }

        let candidate;

        if (this.currentStage === 'SAFE_INIT') {
            candidate = this._drawSafeInit(remainingNumbers);
        } else if (this.currentStage === 'WAITING_PUSH') {
            candidate = this._drawWaitingPush(remainingNumbers);
        } else {
            // NATURAL_FINISH: Random 100%
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
     * GIAI ĐOẠN 1: Bốc số an toàn
     * - Trước số thứ 10: Chặn cả 4/5 (Chờ) và 5/5 (Bingo)
     * - Từ số 10 đến K: Chỉ chặn 5/5 (Bingo)
     * Vi phạm → hủy và bốc lại ngầm
     */
    _drawSafeInit(remaining) {
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

                        // Vi phạm Bingo (5/5): nếu row đang 4/5 và val là số cuối
                        if (hits === 4) {
                            isViolated = true;
                            break;
                        }

                        // Vi phạm Chờ sớm (4/5) trước số thứ 10
                        if (this.drawnNumbers.size < 10 && hits === 3) {
                            isViolated = true;
                            break;
                        }
                    }
                    if (isViolated) break;
                }
                if (isViolated) break;
            }

            if (!isViolated) return val;
        }

        // Fallback: nếu không còn số nào "sạch" (cực kỳ hiếm)
        return remaining[0];
    }

    /**
     * GIAI ĐOẠN 2: Đẩy mọi người vào thế chờ (4/5)
     * Bắt buộc chạy cho đến khi 100% người chơi đều có ít nhất 1 hàng đạt 4/5
     * 
     * Logic:
     * 1. Xác định người chơi chưa có hàng chờ
     * 2. Lập Target_Pool từ rows 3/5 (ưu tiên) rồi 2/5
     * 3. Chọn số xuất hiện nhiều nhất trong Target_Pool
     */
    _drawWaitingPush(remaining) {
        // Lọc người chơi chưa có bất kỳ hàng nào đạt 4/5
        const notWaitingPlayers = this.players.filter(player => {
            if (!player.tickets) return false;
            return !player.tickets.some(ticket =>
                ticket.some(row => this.getRowStatus(row).hits >= 4)
            );
        });

        const targetPool = [];

        // Ưu tiên 1: Tìm số để đẩy rows 3/5 lên 4/5
        for (const player of notWaitingPlayers) {
            if (!player.tickets) continue;
            for (const ticket of player.tickets) {
                for (const row of ticket) {
                    const { hits } = this.getRowStatus(row);
                    if (hits === 3) {
                        // Tìm các số chưa bốc trong row này
                        const missingNumbers = row.filter(n => n !== 0 && !this.drawnNumbers.has(n));
                        missingNumbers.forEach(n => {
                            if (remaining.includes(n)) targetPool.push(n);
                        });
                    }
                }
            }
        }

        // Ưu tiên 2: Nếu chưa có target từ rows 3/5, tìm rows 2/5
        if (targetPool.length === 0) {
            for (const player of notWaitingPlayers) {
                if (!player.tickets) continue;
                for (const ticket of player.tickets) {
                    for (const row of ticket) {
                        const { hits } = this.getRowStatus(row);
                        if (hits === 2) {
                            const missingNumbers = row.filter(n => n !== 0 && !this.drawnNumbers.has(n));
                            missingNumbers.forEach(n => {
                                if (remaining.includes(n)) targetPool.push(n);
                            });
                        }
                    }
                }
            }
        }

        if (targetPool.length > 0) {
            // Chọn số xuất hiện nhiều nhất trong targetPool
            const frequency = {};
            targetPool.forEach(n => {
                frequency[n] = (frequency[n] || 0) + 1;
            });
            const bestNumber = Object.keys(frequency)
                .sort((a, b) => frequency[b] - frequency[a])[0];
            return parseInt(bestNumber);
        }

        // Fallback: random
        return remaining[Math.floor(Math.random() * remaining.length)];
    }
}

module.exports = LotoController;
