const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const GameManager = require('./gameManager');

const app = express();
app.use(cors());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Still allow all for flexible deployment, change to specific domain for extra security
        methods: ["GET", "POST"]
    }
});

const gameManager = new GameManager(io);

// Catch-all route to serve index.html for React Router (using regex for Express 5 compatibility)
app.get(/^(?!\/socket\.io).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', (data, callback) => {
        console.log('Received createRoom request from', socket.id);
        try {
            const roomId = gameManager.createRoom(socket.id);
            console.log('Room created:', roomId);
            socket.join(roomId);
            callback({ roomId });
        } catch (err) {
            console.error('Error creating room:', err);
            callback({ error: 'Failed to create room' });
        }
    });

    socket.on('joinRoom', ({ roomId, playerName }, callback) => {
        const res = gameManager.joinRoom(roomId, socket.id, playerName);
        if (res.error) {
            callback({ error: res.error });
        } else {
            socket.join(roomId);
            callback({ success: true, room: res.room });
            io.to(roomId).emit('playerJoined', res.room.players);
            // Also emit history update to the joining player? The callback handles it.
            // But we might want to broadcast history if it changes dynamically (only on win)
        }
    });

    socket.on('selectSet', ({ roomId, setId }, callback) => {
        console.log(`Socket ${socket.id} selecting set ${setId} in room ${roomId}`);
        try {
            const res = gameManager.selectSet(roomId, socket.id, setId);
            console.log('selectSet result:', res);
            if (res && res.success) {
                callback(res);
                // Notify room that set is taken
                const room = gameManager.rooms.get(roomId);
                io.to(roomId).emit('setsUpdated', room.availableSets);
                io.to(roomId).emit('playerUpdated', room.players);
            } else {
                callback({ error: res ? res.error : 'Failed' });
            }
        } catch (err) {
            console.error('Error in selectSet:', err);
            callback({ error: 'Server error during selection' });
        }
    });

    socket.on('toggleReady', ({ roomId }, callback) => {
        const res = gameManager.toggleReady(roomId, socket.id);
        if (res && res.success) {
            if (callback) callback({ success: true, isReady: res.isReady });
            const room = gameManager.rooms.get(roomId);
            io.to(roomId).emit('playerUpdated', room.players);
        } else {
            if (callback) callback({ error: res ? res.error : 'Failed' });
        }
    });

    socket.on('removePlayer', ({ roomId, playerId }, callback) => {
        const room = gameManager.rooms.get(roomId);
        if (!room || room.hostId !== socket.id) {
            if (callback) callback({ error: 'Unauthorized' });
            return;
        }

        const res = gameManager.removePlayer(roomId, playerId);
        if (res && res.success) {
            if (callback) callback({ success: true });
            io.to(roomId).emit('playerUpdated', res.players);
            io.to(roomId).emit('setsUpdated', res.availableSets);
        } else {
            if (callback) callback({ error: res ? res.error : 'Failed' });
        }
    });

    socket.on('action', ({ roomId, action }, callback) => {
        // Host actions
        const room = gameManager.rooms.get(roomId);
        if (!room || room.hostId !== socket.id) return;

        if (action === 'START') {
            const res = gameManager.startGame(roomId);
            if (res && res.error) {
                // Notify host of error (optional, checking via UI is better)
                return;
            }
        }
        if (action === 'PAUSE') gameManager.pauseGame(roomId);
        if (action === 'RESUME') gameManager.resumeGame(roomId);
        if (action === 'RESTART') gameManager.restartGame(roomId);

        io.to(roomId).emit('gameStateChanged', room.gameState);
    });

    socket.on('setDrawInterval', ({ roomId, seconds }, callback) => {
        const room = gameManager.rooms.get(roomId);
        if (!room || room.hostId !== socket.id) {
            if (callback) callback({ error: 'Unauthorized' });
            return;
        }

        const res = gameManager.setDrawInterval(roomId, seconds);
        if (callback) callback(res);

        // Notify all players of the new interval
        io.to(roomId).emit('drawIntervalChanged', { drawIntervalSeconds: res.drawIntervalSeconds });
    });

    socket.on('kinh', ({ roomId, markedNumbers }, callback) => {
        const res = gameManager.verifyKinh(roomId, socket.id, markedNumbers);

        if (res.error) {
            if (callback) callback({ error: res.error });
            return;
        }

        const room = gameManager.rooms.get(roomId);
        const player = room.players.find(p => p.id === socket.id);

        // Emit verification popup to host
        io.to(room.hostId).emit('kinhVerification', {
            playerName: player.name,
            playerTickets: player.tickets,
            markedNumbers: markedNumbers,
            drawnNumbers: room.numbersDrawn,
            success: res.success,
            reason: res.reason,
            message: res.message
        });

        if (res.success) {
            // Valid bingo!
            gameManager.handleBingo(room, res.player);
            if (callback) callback({ success: true, reason: 'BINGO' });
        } else {
            // Kinh sai (false claim)
            gameManager.handleKinhSai(room, player);
            if (callback) callback({ success: false, reason: 'KINH_SAI', message: res.message });
        }
    });



    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // gameManager.leaveRoom(socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
