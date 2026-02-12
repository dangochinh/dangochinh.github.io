import { describe, it, expect } from 'vitest';
import { checkForBingo, TicketGrid } from './gameLogic';

describe('checkForBingo', () => {
    // Helper to create a dummy ticket row
    const createRow = (nums: number[]): number[] => {
        const row = Array(9).fill(0);
        nums.forEach((n, i) => row[i] = n); // Simplified placement
        return row;
    };

    // Helper to create a dummy ticket
    const createTicket = (winningRowIndex: number, winningNums?: number[]): TicketGrid => {
        const ticket: TicketGrid = [];
        for (let i = 0; i < 5; i++) {
            if (i === winningRowIndex && winningNums) {
                ticket.push(createRow(winningNums));
            } else {
                ticket.push(createRow([1, 2, 3, 4, 5])); // Generic numbers
            }
        }
        return ticket;
    };

    it('should return false for empty tickets or drawn numbers', () => {
        expect(checkForBingo([], [])).toBe(false);
        // @ts-ignore testing invalid input for robustness if desired, or skip
        // expect(checkForBingo(null, [])).toBe(false); 
    });

    it('should return true when a row is fully drawn', () => {
        const winningNums = [10, 20, 30, 40, 50];
        const ticket = createTicket(2, winningNums); // Winning row at index 2
        const drawnNumbers = [1, 2, 3, ...winningNums, 99];
        // Wrap in array to match TicketSet type
        expect(checkForBingo([ticket], drawnNumbers)).toBe(true);
    });

    it('should return false when a row is partially drawn', () => {
        const winningNums = [10, 20, 30, 40, 50];
        const ticket = createTicket(2, winningNums);
        const drawnNumbers = [10, 20, 30, 40]; // Missing 50

        expect(checkForBingo([ticket], drawnNumbers)).toBe(false);
    });

    it('should return true if ANY ticket has a bingo in a multi-ticket set', () => {
        const losingTicket = createTicket(0, [1, 2, 3, 4, 5]); // Drawn: []
        const winningNums = [10, 20, 30, 40, 50];
        const winningTicket = createTicket(0, winningNums);

        const drawnNumbers = [...winningNums];

        expect(checkForBingo([losingTicket, winningTicket], drawnNumbers)).toBe(true);
    });
});
