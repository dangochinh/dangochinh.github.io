const { getAllTicketSets } = require('./utils/ticketGenerator');
const { db } = require('./firebase');
const { collection, addDoc, getDocs, query, orderBy, limit } = require('firebase/firestore');

class GameManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map();
        this.globalWinHistory = [];
        this.loadWinHistory();
    }

    async loadWinHistory() {
        try {
            const q = query(
                collection(db, "winHistory"),
                orderBy("timestamp", "desc"),
                limit(50)
            );
            const querySnapshot = await getDocs(q);
            const history = [];
            querySnapshot.forEach((doc) => {
                history.push(doc.data());
            });
            // Reverse because we want oldest first in the array (UI reverses it back)
            this.globalWinHistory = history.reverse();
            console.log(`Loaded ${this.globalWinHistory.length} win records from Firestore`);
        } catch (error) {
            console.error("Error loading win history:", error);
        }
    }

    async saveWinToFirestore(winRecord) {
        try {
            await addDoc(collection(db, "winHistory"), {
                ...winRecord,
                timestamp: winRecord.timestamp // Already a Date object
            });
            console.log("Win record saved to Firestore");
        } catch (error) {
            console.error("Error saving win record:", error);
        }
    }

    createRoom(hostSocketId) {
        const roomId = this.generateRoomId();

        // Get all 30 ticket sets (16 predefined + 14 random)
        const allSets = getAllTicketSets();
        const availableSets = allSets.map(set => ({
            id: set.id,
            name: set.name,
            color: set.color,
            data: set.data,
            isTaken: false
        }));

        this.rooms.set(roomId, {
            id: roomId,
            hostId: hostSocketId,
            players: [], // { socketId, name, setId }
            gameState: 'WAITING', // WAITING, PLAYING, PAUSED, ENDED
            numbersDrawn: [],
            availableSets: availableSets,
            drawInterval: null,
            drawIntervalSeconds: 3, // Default 3 seconds
            currentNumber: null,
            winHistory: this.globalWinHistory // Initialize with global history
        });

        return roomId;
    }

    joinRoom(roomId, playerSocketId, playerName) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Room not found' };
        if (room.gameState !== 'WAITING') return { error: 'Game already started' };

        // Player joins, hasn't picked ticket yet
        const player = {
            id: playerSocketId,
            name: playerName,
            setId: null,
            tickets: null,
            isReady: false
        };

        room.players.push(player);

        return {
            success: true,
            room: {
                roomId: room.id,
                gameState: room.gameState,
                availableSets: room.availableSets,
                players: room.players,
                numbersDrawn: room.numbersDrawn,
                currentNumber: room.currentNumber,
                winHistory: room.winHistory
            }
        };
    }

    selectSet(roomId, playerId, setId) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Room not found' };

        const set = room.availableSets.find(s => s.id === setId);
        if (!set) return { error: 'Set not found' }; // Added check for !set
        if (set.isTaken) return { error: 'Set already taken' };

        const player = room.players.find(p => p.id === playerId); // Changed userId to playerId
        if (!player) return { error: 'Player not found' };

        // If player already has a set, release it first (Change Ticket)
        if (player.setId) {
            const oldSet = room.availableSets.find(s => s.id === player.setId);
            if (oldSet) oldSet.isTaken = false;
        }

        set.isTaken = true;
        player.setId = setId;
        player.tickets = set.data; // Changed set.tickets to set.data

        // Reset ready status if they change ticket
        player.isReady = false;

        // Broadcast updates - Handled by index.js callback
        // this.emitAvailableSets(roomId);

        return { success: true, tickets: set.data };
    }

    removePlayer(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Room not found' };

        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return { error: 'Player not found' };

        const player = room.players[playerIndex];

        // Release the player's ticket set
        if (player.setId) {
            const set = room.availableSets.find(s => s.id === player.setId);
            if (set) set.isTaken = false;
        }

        // Remove player from the room
        room.players.splice(playerIndex, 1);

        return { success: true, players: room.players, availableSets: room.availableSets };
    }

    leaveRoom(socketId) {
        // Handle disconnection
        // For now, players remain in the room until host removes them
    }

    startGame(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        // Check if all players are ready
        const allReady = room.players.every(p => p.isReady);
        if (room.players.length === 0) return; // Can't start empty
        if (!allReady) return { error: 'Not all players are ready' };

        room.gameState = 'PLAYING';
        this.startDrawLoop(roomId);
        return { success: true };
    }

    toggleReady(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (!player) return;

        // Can only toggle if picked a set
        if (!player.setId) return { error: 'Must select a ticket first' };

        player.isReady = !player.isReady;
        return { success: true, isReady: player.isReady, players: room.players };
    }

    pauseGame(roomId) {
        const room = this.rooms.get(roomId);
        if (room && room.drawInterval) {
            clearInterval(room.drawInterval);
            room.drawInterval = null;
            room.gameState = 'PAUSED';
        }
    }

    resumeGame(roomId) {
        const room = this.rooms.get(roomId);
        if (room && room.gameState === 'PAUSED') {
            room.gameState = 'PLAYING';
            this.startDrawLoop(roomId);
        }
    }

    restartGame(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        // Reset Game State
        if (room.drawInterval) clearInterval(room.drawInterval);
        room.drawInterval = null;
        room.gameState = 'WAITING';
        room.numbersDrawn = [];
        room.currentNumber = null;

        // Reset player state (keep tickets, reset ready)
        room.players.forEach(p => {
            // p.tickets = null; // Don't clear tickets
            // p.setId = null;   // Don't clear set ID
            p.isReady = false;
        });

        // Re-sync available sets: Mark sets held by players as taken, release dropped ones?
        // Actually, since we didn't clear setId, the isTaken status in availableSets 
        // should ideally strictly match players' held sets.
        // Let's regenerate isTaken integrity just in case
        room.availableSets.forEach(s => {
            const heldByPlayer = room.players.some(p => p.setId === s.id);
            s.isTaken = heldByPlayer;
        });

        this.io.to(roomId).emit('gameRestarted', {
            gameState: room.gameState,
            players: room.players,
            availableSets: room.availableSets,
            winHistory: room.winHistory
        });
    }

    startDrawLoop(roomId) {
        const room = this.rooms.get(roomId);
        if (room.drawInterval) clearInterval(room.drawInterval);

        // Use configurable interval (default 3 seconds)
        const intervalMs = (room.drawIntervalSeconds || 3) * 1000;
        room.drawInterval = setInterval(() => {
            this.drawNumber(roomId);
        }, intervalMs);
    }

    drawNumber(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        if (room.numbersDrawn.length >= 90) {
            this.endGame(roomId);
            return;
        }

        let num;
        do {
            num = Math.floor(Math.random() * 90) + 1;
        } while (room.numbersDrawn.includes(num));

        room.numbersDrawn.push(num);
        room.currentNumber = num;

        this.io.to(roomId).emit('numberDrawn', { number: num, history: room.numbersDrawn });

        // Manual verification: Players must call "Kinh" to claim bingo
    }

    checkBingo(room) {
        // Check all players
        for (const player of room.players) {
            if (!player.tickets) continue;

            // Check each ticket in the set (3 tickets)
            for (const ticket of player.tickets) {
                // Check each row (3 rows)
                for (let r = 0; r < 3; r++) {
                    // Counts matches in row
                    let matches = 0;
                    for (let c = 0; c < 9; c++) {
                        const val = ticket[r][c];
                        if (val !== 0 && room.numbersDrawn.includes(val)) {
                            matches++;
                        }
                    }
                    if (matches === 5) {
                        // BINGO!
                        this.handleBingo(room, player);
                        return;
                    }
                }
            }
        }
    }

    verifyKinh(roomId, playerId, markedNumbers) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Room not found' };

        const player = room.players.find(p => p.id === playerId);
        if (!player) return { error: 'Player not found' };
        if (!player.tickets) return { error: 'No tickets assigned' };

        // Pause the game immediately
        this.pauseGame(roomId);

        // Check if ANY row in player's tickets has all 5 numbers drawn
        // This is the ACTUAL bingo check, not based on what player marked
        let hasBingo = false;
        for (const ticket of player.tickets) {
            for (let r = 0; r < 3; r++) {
                let matches = 0;
                for (let c = 0; c < 9; c++) {
                    const val = ticket[r][c];
                    // Check if this number has been DRAWN (not marked by player)
                    if (val !== 0 && room.numbersDrawn.includes(val)) {
                        matches++;
                    }
                }
                if (matches === 5) {
                    hasBingo = true;
                    break;
                }
            }
            if (hasBingo) break;
        }

        if (hasBingo) {
            return {
                success: true,
                reason: 'BINGO',
                player: player
            };
        } else {
            return {
                success: false,
                reason: 'KINH_SAI',
                message: 'No complete row found with all numbers drawn'
            };
        }
    }

    handleBingo(room, winner) {
        this.pauseGame(room.id);

        const winRecord = {
            name: winner.name,
            timestamp: new Date(),
            round: (this.globalWinHistory.length > 0 ? this.globalWinHistory[this.globalWinHistory.length - 1].round : 0) + 1,
            players: room.players.map(p => ({ name: p.name, setId: p.setId })),
            type: 'win',
            reason: 'BINGO'
        };

        // Add to global history
        this.globalWinHistory.push(winRecord);
        if (this.globalWinHistory.length > 50) {
            this.globalWinHistory = this.globalWinHistory.slice(-50);
        }

        // Update room's win history reference
        room.winHistory = this.globalWinHistory;

        // Persist to Firestore
        this.saveWinToFirestore(winRecord);

        this.io.to(room.id).emit('gameEnded', {
            winner: winner.name,
            reason: 'BINGO',
            fullHistory: room.numbersDrawn,
            winHistory: room.winHistory
        });
        room.gameState = 'ENDED';
    }

    handleKinhSai(room, player) {
        const failRecord = {
            name: player.name,
            timestamp: new Date(),
            round: (this.globalWinHistory.length > 0 ? this.globalWinHistory[this.globalWinHistory.length - 1].round : 0) + 1,
            players: room.players.map(p => ({ name: p.name, setId: p.setId })),
            type: 'fail',
            reason: 'KINH_SAI'
        };

        // Add to global history
        this.globalWinHistory.push(failRecord);
        if (this.globalWinHistory.length > 50) {
            this.globalWinHistory = this.globalWinHistory.slice(-50);
        }

        // Update room's win history reference
        room.winHistory = this.globalWinHistory;

        // Persist to Firestore
        this.saveWinToFirestore(failRecord);

        this.io.to(room.id).emit('kinhFailed', {
            playerName: player.name,
            winHistory: room.winHistory
        });
    }

    endGame(roomId) {
        this.pauseGame(roomId);
        this.io.to(roomId).emit('gameEnded', { winner: null, reason: 'Full Board' });
    }

    generateRoomId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    setDrawInterval(roomId, seconds) {
        const room = this.rooms.get(roomId);
        if (!room) return { error: 'Room not found' };

        room.drawIntervalSeconds = Math.max(1, Math.min(60, seconds)); // Clamp between 1-60 seconds

        // If game is playing, restart the interval with new timing
        if (room.gameState === 'PLAYING' && room.drawInterval) {
            clearInterval(room.drawInterval);
            this.startDrawLoop(roomId);
        }

        return { success: true, drawIntervalSeconds: room.drawIntervalSeconds };
    }
}

module.exports = GameManager;
