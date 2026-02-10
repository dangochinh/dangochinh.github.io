import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getAllTicketSets } from '../utils/ticketGenerator'; // You'll need to move/ensure this exists client-side

export const useHostGame = (roomId) => {
    const [gameState, setGameState] = useState('WAITING'); // WAITING, PLAYING, PAUSED, ENDED
    const [players, setPlayers] = useState([]);
    const [numbersDrawn, setNumbersDrawn] = useState([]);
    const [currentNumber, setCurrentNumber] = useState(null);
    const [winHistory, setWinHistory] = useState([]); // In-memory for now, can sync with DB later
    const [verificationPopup, setVerificationPopup] = useState(null);
    const [drawIntervalSeconds, setDrawIntervalSeconds] = useState(3);

    // Refs for state accessed inside callbacks/intervals
    const gameStateRef = useRef(gameState);
    const playersRef = useRef(players);
    const numbersDrawnRef = useRef(numbersDrawn);
    const winHistoryRef = useRef(winHistory);
    const failuresRef = useRef([]); // Track failures in current round
    const drawIntervalRef = useRef(null);
    const channelRef = useRef(null);

    // Sync refs
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { playersRef.current = players; }, [players]);
    useEffect(() => { numbersDrawnRef.current = numbersDrawn; }, [numbersDrawn]);
    useEffect(() => { winHistoryRef.current = winHistory; }, [winHistory]);

    // Initialize available sets
    const [availableSets, setAvailableSets] = useState([]);
    useEffect(() => {
        // Initialize sets similar to server logic
        const allSets = getAllTicketSets();
        const sets = allSets.map(set => ({
            id: set.id,
            name: set.name,
            color: set.color,
            data: set.data, // This contains the ticket matrix
            isTaken: false
        }));
        setAvailableSets(sets);
    }, []);

    const availableSetsRef = useRef(availableSets);
    useEffect(() => { availableSetsRef.current = availableSets; }, [availableSets]);

    // Broadcast helper
    const broadcast = useCallback((event, payload) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: event,
                payload: payload
            });
        }
    }, []);

    // Game Loop
    const drawNumber = useCallback(() => {
        if (gameStateRef.current !== 'PLAYING') return;
        if (numbersDrawnRef.current.length >= 90) {
            pauseGame();
            setGameState('ENDED');
            broadcast('gameStateChanged', 'ENDED');
            broadcast('gameEnded', { winner: null, reason: 'Full Board' });
            return;
        }

        let num;
        do {
            num = Math.floor(Math.random() * 90) + 1;
        } while (numbersDrawnRef.current.includes(num));

        const newHistory = [...numbersDrawnRef.current, num];
        setNumbersDrawn(newHistory);
        setCurrentNumber(num);

        broadcast('numberDrawn', { number: num, history: newHistory });
    }, [broadcast]);

    const startGame = () => {
        // Validate
        const allReady = playersRef.current.length > 0 && playersRef.current.every(p => p.isReady);
        if (!allReady) {
            alert("Not all players are ready!");
            return;
        }

        setGameState('PLAYING');
        broadcast('gameStateChanged', 'PLAYING');

        // Start Loop
        if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
        drawIntervalRef.current = setInterval(() => {
            drawNumber();
        }, drawIntervalSeconds * 1000);
    };

    const pauseGame = () => {
        if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
        setGameState('PAUSED');
        broadcast('gameStateChanged', 'PAUSED');
    };

    const resumeGame = () => {
        // Start Loop
        if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
        drawIntervalRef.current = setInterval(() => {
            drawNumber();
        }, drawIntervalSeconds * 1000);
        setGameState('PLAYING');
        broadcast('gameStateChanged', 'PLAYING');
    };

    const restartGame = () => {
        if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
        setGameState('WAITING');
        setNumbersDrawn([]);
        setCurrentNumber(null);
        failuresRef.current = []; // Clear failures

        // Reset players ready state
        const resetPlayers = playersRef.current.map(p => ({ ...p, isReady: false }));
        setPlayers(resetPlayers);

        // Reset sets isTaken based on players (should remain same as they keep sets)
        // But in restart, maybe we want to keep them seated.

        broadcast('gameRestarted', {
            gameState: 'WAITING',
            players: resetPlayers,
            winHistory
        });
    };

    const verifyKinh = (playerId, markedNumbers) => {
        const player = playersRef.current.find(p => p.id === playerId);
        if (!player) return;

        pauseGame(); // Pause immediately

        const tickets = player.tickets; // The matrix 3x9x3
        let hasBingo = false;

        // Verify Logic
        for (const ticket of tickets) {
            for (let r = 0; r < 3; r++) {
                let matches = 0;
                for (let c = 0; c < 9; c++) {
                    const val = ticket[r][c];
                    if (val !== 0 && numbersDrawnRef.current.includes(val)) {
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

        // Calculate current round based on number of wins
        const currentRound = winHistoryRef.current.filter(r => r.type === 'win').length + 1;

        if (hasBingo) {
            // Bingo!
            const winRecord = {
                name: player.name,
                timestamp: new Date(),
                round: currentRound,
                reason: 'BINGO',
                type: 'win',
                players: JSON.parse(JSON.stringify(playersRef.current)),
                failures: [...failuresRef.current] // Include failures in history
            };
            const newHistory = [...winHistoryRef.current, winRecord];
            setWinHistory(newHistory); // In memory

            broadcast('gameEnded', {
                winner: player.name,
                reason: 'BINGO',
                fullHistory: numbersDrawnRef.current,
                winHistory: newHistory
            });
            setGameState('ENDED');
            failuresRef.current = []; // Reset failures for next game

            // Show popup to Host
            setVerificationPopup({
                success: true,
                playerName: player.name,
                playerTickets: player.tickets,
                markedNumbers,
                drawnNumbers: numbersDrawnRef.current,
                message: "BINGO! Valid verification."
            });
        } else {
            // False Claim
            const failRecord = {
                name: player.name,
                timestamp: new Date(),
                round: currentRound,
                reason: 'KINH_SAI',
                type: 'fail',
                players: JSON.parse(JSON.stringify(playersRef.current))
            };

            // Track failure for this round
            failuresRef.current.push(failRecord);

            // We don't necessarily need to add to global winHistory immediately if we only want it in the final record,
            // BUT the user might want a log of "events". 
            // The current implementation adds "failRecord" to `winHistory` directly.
            // If we keep doing that, the CSV will have rows for "KINH_SAI".
            // The request was "History ghi lại lịch sử của tất cả những ng kinh sai + người chơi của ván đó".
            // And "file CSV cũng ghi nhận thông tin tương tự".

            // If we add it to `winHistory`, it appears as a row.
            // If we ALSO add it to `winRecord` of the winner, it appears in the "Failures" column of the winner's row.
            // This seems redundant but covers both requests (real-time log vs summary).

            // Let's keep adding to winHistory for real-time log.
            const newHistory = [...winHistoryRef.current, failRecord];
            setWinHistory(newHistory);

            broadcast('kinhFailed', {
                playerName: player.name,
                winHistory: newHistory
            });

            // Show popup to Host
            setVerificationPopup({
                success: false,
                playerName: player.name,
                playerTickets: player.tickets,
                markedNumbers,
                drawnNumbers: numbersDrawnRef.current,
                message: "KINH SAI! Player does not have a full row of drawn numbers."
            });
        }
    };


    // Supabase Connection
    useEffect(() => {
        if (!roomId) return;

        const channel = supabase.channel(`room:${roomId}`, {
            config: {
                broadcast: { self: true }, // Host receives own? No need usually
            }
        });

        channel
            .on('broadcast', { event: 'joinRequest' }, ({ payload }) => {
                // Player wants to join
                // Check if player exists or just update socket ID equivalent?
                // In Supabase, we don't have socket ID. we use payload.id (uuid generated by client)

                const { id, name } = payload;
                console.log(`Player requesting to join: ${name} (${id})`);

                const existingPlayer = playersRef.current.find(p => p.id === id);
                let newPlayers = playersRef.current;

                if (!existingPlayer) {
                    const newPlayer = {
                        id,
                        name,
                        setId: null,
                        tickets: null,
                        isReady: false
                    };
                    newPlayers = [...playersRef.current, newPlayer];
                    setPlayers(newPlayers);
                } else if (existingPlayer.name !== name) {
                    // Update name if changed
                    newPlayers = playersRef.current.map(p =>
                        p.id === id ? { ...p, name } : p
                    );
                    setPlayers(newPlayers);
                }

                // Send initial state back to THAT player (or everyone, easier)
                // Since we can't whisper easily in Broadcast without a "to" filter (which Supabase doesn't strictly have in Broadcast mode efficiently without listening to specific channels), 
                // we'll just broadcast 'gameStateSync' which clients filter by "if it was me who asked"

                broadcast('playerJoined', newPlayers); // Update everyone's player list

                // Also give the joining player the current game data
                // We broadcast 'roomDataSync' that contains everything.
                // Clients responsible for filtering or applying.
                broadcast('roomDataSync', {
                    roomId,
                    gameState: gameStateRef.current,
                    availableSets: availableSetsRef.current,
                    players: newPlayers,
                    numbersDrawn: numbersDrawnRef.current,
                    currentNumber: currentNumber,
                    winHistory
                });

                // Also send setsUpdated explicitly for clarity
                broadcast('setsUpdated', availableSetsRef.current);
            })
            .on('broadcast', { event: 'selectSet' }, ({ payload }) => {
                const { playerId, setId } = payload;

                const playersList = [...playersRef.current];
                const player = playersList.find(p => p.id === playerId);
                const sets = [...availableSetsRef.current];
                const set = sets.find(s => s.id === setId);

                if (player && set && !set.isTaken) {
                    // Release old set
                    if (player.setId) {
                        const oldSet = sets.find(s => s.id === player.setId);
                        if (oldSet) oldSet.isTaken = false;
                    }

                    // Take new set
                    set.isTaken = true;
                    player.setId = setId;
                    player.tickets = set.data;
                    player.isReady = false;

                    setPlayers(playersList);
                    setAvailableSets(sets);

                    broadcast('setsUpdated', sets);
                    broadcast('playerUpdated', playersList);

                    // Confirm to player (broadcast success, player checks ID)
                    broadcast('selectSetSuccess', { playerId, tickets: set.data });
                } else {
                    broadcast('selectSetError', { playerId, message: 'Set unavailable or failed' });
                }
            })
            .on('broadcast', { event: 'toggleReady' }, ({ payload }) => {
                const { playerId } = payload;
                const playersList = playersRef.current.map(p =>
                    p.id === playerId ? { ...p, isReady: !p.isReady } : p
                );
                setPlayers(playersList);
                setPlayers(playersList);
                broadcast('playerUpdated', playersList);
            })
            .on('broadcast', { event: 'unselectSet' }, ({ payload }) => {
                const { playerId } = payload;
                const playersList = [...playersRef.current];
                const player = playersList.find(p => p.id === playerId);

                if (player && player.setId) {
                    const sets = [...availableSetsRef.current];
                    const set = sets.find(s => s.id === player.setId);

                    if (set) set.isTaken = false;

                    player.setId = null;
                    player.tickets = null;
                    player.isReady = false;

                    setPlayers(playersList);
                    setAvailableSets(sets);

                    broadcast('setsUpdated', sets);
                    broadcast('playerUpdated', playersList);
                    broadcast('unselectSetSuccess', { playerId }); // Optional confirmation
                }
            })
            .on('broadcast', { event: 'kinh' }, ({ payload }) => {
                const { playerId, markedNumbers } = payload;
                verifyKinh(playerId, markedNumbers);
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log("Host subscribed to room:", roomId);
                    channelRef.current = channel;
                }
            });

        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
            if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
        };
    }, [roomId, broadcast]); // Dependencies shouldn't change often

    // Effect to update interval when valid changed
    useEffect(() => {
        if (gameState === 'PLAYING') {
            clearInterval(drawIntervalRef.current);
            drawIntervalRef.current = setInterval(() => {
                drawNumber();
            }, drawIntervalSeconds * 1000);
        }
    }, [drawIntervalSeconds]);

    return {
        gameState,
        players,
        numbersDrawn,
        currentNumber,
        winHistory,
        verificationPopup,
        availableSets,
        drawIntervalSeconds,
        actions: {
            startGame,
            pauseGame,
            resumeGame,
            restartGame,
            setDrawIntervalSeconds,
            setVerificationPopup,
            removePlayer: (pid) => {
                // Logic to remove player
                const playersList = playersRef.current.filter(p => p.id !== pid);
                const removedPlayer = playersRef.current.find(p => p.id === pid);

                // Release set
                if (removedPlayer && removedPlayer.setId) {
                    const sets = [...availableSetsRef.current];
                    const set = sets.find(s => s.id === removedPlayer.setId);
                    if (set) set.isTaken = false;
                    setAvailableSets(sets);
                    broadcast('setsUpdated', sets);
                }

                setPlayers(playersList);
                broadcast('playerUpdated', playersList);
            }
        }
    };
};
