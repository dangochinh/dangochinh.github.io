import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getAllTicketSets } from '../utils/ticketGenerator';
import { checkForBingo } from '../utils/gameLogic';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Player, GameState, WinRecord, VerificationPopup, TicketSetInfo } from '../types';

export const useHostGame = (roomId: string | undefined) => {
    const [gameState, setGameState] = useState<GameState>('WAITING');
    const [players, setPlayers] = useState<Player[]>([]);
    const [numbersDrawn, setNumbersDrawn] = useState<number[]>([]);
    const [currentNumber, setCurrentNumber] = useState<number | null>(null);
    const [winHistory, setWinHistory] = useState<WinRecord[]>([]);
    const [verificationPopup, setVerificationPopup] = useState<VerificationPopup | null>(null);
    const [drawIntervalSeconds, setDrawIntervalSeconds] = useState<number>(3);

    // Refs for state accessed inside callbacks/intervals
    const gameStateRef = useRef<GameState>(gameState);
    const playersRef = useRef<Player[]>(players);
    const numbersDrawnRef = useRef<number[]>(numbersDrawn);
    const winHistoryRef = useRef<WinRecord[]>(winHistory);
    const failuresRef = useRef<WinRecord[]>([]);
    const drawIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Sync refs
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
    useEffect(() => { playersRef.current = players; }, [players]);
    useEffect(() => { numbersDrawnRef.current = numbersDrawn; }, [numbersDrawn]);
    useEffect(() => { winHistoryRef.current = winHistory; }, [winHistory]);

    // Initialize available sets
    const [availableSets, setAvailableSets] = useState<TicketSetInfo[]>([]);
    useEffect(() => {
        const allSets = getAllTicketSets();
        const sets: TicketSetInfo[] = allSets.map(set => ({
            id: set.id,
            name: set.name,
            color: set.color,
            data: set.data,
            isTaken: false
        }));
        setAvailableSets(sets);
    }, []);

    const availableSetsRef = useRef<TicketSetInfo[]>(availableSets);
    useEffect(() => { availableSetsRef.current = availableSets; }, [availableSets]);

    // Broadcast helper
    const broadcast = useCallback((event: string, payload: any) => {
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

        let num: number;
        do {
            num = Math.floor(Math.random() * 90) + 1;
        } while (numbersDrawnRef.current.includes(num));

        const newHistory = [...numbersDrawnRef.current, num];
        setNumbersDrawn(newHistory);
        setCurrentNumber(num);

        broadcast('numberDrawn', { number: num, history: newHistory });
    }, [broadcast]);

    const startGame = () => {
        const allReady = playersRef.current.length > 0 && playersRef.current.every(p => p.isReady);
        if (!allReady) {
            alert("Not all players are ready!");
            return;
        }

        setGameState('PLAYING');
        broadcast('gameStateChanged', 'PLAYING');

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
        failuresRef.current = [];

        const resetPlayers = playersRef.current.map(p => ({ ...p, isReady: false }));
        setPlayers(resetPlayers);

        setWinHistory([]);

        broadcast('gameRestarted', {
            gameState: 'WAITING',
            players: resetPlayers,
            winHistory: []
        });
    };

    const verifyKinh = (playerId: string, markedNumbers: number[]) => {
        const player = playersRef.current.find(p => p.id === playerId);
        if (!player) return;

        pauseGame();

        const hasBingo = checkForBingo(player.tickets, numbersDrawnRef.current);
        const currentRound = winHistoryRef.current.filter(r => r.type === 'win').length + 1;

        if (hasBingo) {
            const winRecord: WinRecord = {
                name: player.name,
                timestamp: new Date(),
                round: currentRound,
                reason: 'BINGO',
                type: 'win',
                players: JSON.parse(JSON.stringify(playersRef.current)),
                failures: [...failuresRef.current]
            };
            const newHistory = [...winHistoryRef.current, winRecord];
            setWinHistory(newHistory); // In memory
            winHistoryRef.current = newHistory; // Update ref immediately

            setVerificationPopup({
                playerName: player.name,
                success: true,
                message: 'Player has BINGO!',
                markedNumbers, // from client claim
                drawnNumbers: numbersDrawnRef.current,
                playerTickets: player.tickets
            });

            broadcast('gameEnded', {
                winner: player,
                reason: 'BINGO',
                winRecord: winRecord
            });
            setGameState('ENDED');
        } else {
            const failRecord: WinRecord = {
                name: player.name,
                timestamp: new Date(),
                round: currentRound,
                reason: 'KINH_SAI',
                type: 'fail',
                players: JSON.parse(JSON.stringify(playersRef.current))
            };

            failuresRef.current.push(failRecord);

            // Update history immediately for "Kinh Sai"
            const newHistory = [...winHistoryRef.current, failRecord];
            setWinHistory(newHistory);
            winHistoryRef.current = newHistory;

            setVerificationPopup({
                playerName: player.name,
                success: false,
                message: `${player.name} kinh sai! Phạt đi!`,
                markedNumbers,
                drawnNumbers: numbersDrawnRef.current,
                playerTickets: player.tickets
            });

            broadcast('verificationResult', {
                success: false,
                playerId: player.id,
                message: `${player.name} kinh sai! Phạt đi!`
            });

            // Sync history to all clients
            broadcast('roomDataSync', {
                gameState: gameStateRef.current,
                numbersDrawn: numbersDrawnRef.current,
                players: playersRef.current,
                availableSets: availableSetsRef.current,
                currentNumber: numbersDrawnRef.current[numbersDrawnRef.current.length - 1] || null,
                winHistory: newHistory
            });
        }
    };

    const endGame = () => {
        if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
        setGameState('ENDED');
        broadcast('gameStateChanged', 'ENDED');
    };

    useEffect(() => {
        if (!roomId) return;

        const channel = supabase.channel(`room:${roomId}`, {
            config: {
                presence: {
                    key: 'host',
                },
            },
        });

        channelRef.current = channel;

        channel
            .on('broadcast', { event: 'requestJoin' }, ({ payload }) => {
                // If player already exists, just sync?
                // Check if player exists by ID
                if (playersRef.current.some(p => p.id === payload.id)) {
                    // Maybe update name if changed?
                    // For now just sync
                    channel.send({
                        type: 'broadcast',
                        event: 'roomDataSync',
                        payload: {
                            gameState: gameStateRef.current,
                            numbersDrawn: numbersDrawnRef.current,
                            players: playersRef.current,
                            availableSets: availableSetsRef.current,
                            currentNumber: numbersDrawnRef.current[numbersDrawnRef.current.length - 1] || null,
                            winHistory: winHistoryRef.current
                        }
                    });
                    return;
                }

                const newPlayer: Player = {
                    id: payload.id,
                    name: payload.name,
                    isReady: false,
                    setId: -1, // Initialize with invalid ID
                    tickets: [] as any,
                    joinedAt: new Date().toISOString()
                };

                // Assign a set if available
                const setArg = availableSetsRef.current.find(s => !s.isTaken);
                if (setArg) {
                    newPlayer.setId = setArg.id;
                    newPlayer.tickets = setArg.data;

                    // Update available sets locally
                    const updatedSets = availableSetsRef.current.map(s => s.id === setArg.id ? { ...s, isTaken: true } : s);
                    setAvailableSets(updatedSets);
                    // Also update ref immediately for next logic
                    availableSetsRef.current = updatedSets;

                    // Send set info back to player? Not strictly needed if we sync roomDataSync, 
                    // but logic might expect 'assignSet'
                    /*
                    channel.send({
                        type: 'broadcast',
                        event: 'assignSet',
                        payload: { playerId: newPlayer.id, set: setArg }
                    });
                    */
                }

                const updatedPlayers = [...playersRef.current, newPlayer];
                setPlayers(updatedPlayers);

                // Sync current state to ALL (including new player)
                channel.send({
                    type: 'broadcast',
                    event: 'roomDataSync',
                    payload: {
                        gameState: gameStateRef.current,
                        numbersDrawn: numbersDrawnRef.current,
                        players: updatedPlayers,
                        availableSets: availableSetsRef.current,
                        currentNumber: numbersDrawnRef.current[numbersDrawnRef.current.length - 1] || null,
                        winHistory: winHistoryRef.current
                    }
                });
            })
            .on('broadcast', { event: 'toggleReady' }, ({ payload }) => {
                setPlayers(prev => prev.map(p => p.id === payload.playerId ? { ...p, isReady: payload.isReady } : p));
                // Broadcast update to all
                channel.send({
                    type: 'broadcast',
                    event: 'playerUpdated',
                    payload: playersRef.current.map(p => p.id === payload.playerId ? { ...p, isReady: payload.isReady } : p)
                });
            })
            .on('broadcast', { event: 'kinh' }, ({ payload }) => {
                const { playerId, markedNumbers } = payload;
                verifyKinh(playerId, markedNumbers);
            })
            .on('broadcast', { event: 'requestSet' }, ({ payload }) => {
                const { playerId, setId } = payload;
                const player = playersRef.current.find(p => p.id === playerId);
                if (!player) return;

                // Check if set is available
                const targetSet = availableSetsRef.current.find(s => s.id === setId);
                if (!targetSet || targetSet.isTaken) return; // Already taken or invalid

                // Release old set
                let updatedSets = [...availableSetsRef.current];
                if (player.setId !== -1) {
                    updatedSets = updatedSets.map(s => s.id === player.setId ? { ...s, isTaken: false } : s);
                }

                // Take new set
                updatedSets = updatedSets.map(s => s.id === setId ? { ...s, isTaken: true } : s);

                setAvailableSets(updatedSets);
                availableSetsRef.current = updatedSets;

                // Update player
                const updatedPlayers = playersRef.current.map(p => p.id === playerId ? { ...p, setId: setId, tickets: targetSet.data } : p);
                setPlayers(updatedPlayers);

                // Broadcast updates
                channel.send({
                    type: 'broadcast',
                    event: 'roomDataSync',
                    payload: {
                        gameState: gameStateRef.current,
                        numbersDrawn: numbersDrawnRef.current,
                        players: updatedPlayers,
                        availableSets: updatedSets,
                        currentNumber: numbersDrawnRef.current[numbersDrawnRef.current.length - 1] || null,
                        winHistory: winHistoryRef.current
                    }
                });
            })
            .on('broadcast', { event: 'unselectSet' }, ({ payload }) => {
                const { playerId } = payload;
                const player = playersRef.current.find(p => p.id === playerId);
                if (!player) return;

                // Release set
                if (player.setId !== -1) {
                    const updatedSets = availableSetsRef.current.map(s => s.id === player.setId ? { ...s, isTaken: false } : s);
                    setAvailableSets(updatedSets);
                    availableSetsRef.current = updatedSets;

                    // Update player to have no set
                    const updatedPlayers = playersRef.current.map(p => p.id === playerId ? { ...p, setId: -1, tickets: [] as any } : p);
                    setPlayers(updatedPlayers);

                    channel.send({
                        type: 'broadcast',
                        event: 'roomDataSync',
                        payload: {
                            gameState: gameStateRef.current,
                            numbersDrawn: numbersDrawnRef.current,
                            players: updatedPlayers,
                            availableSets: updatedSets,
                            currentNumber: numbersDrawnRef.current[numbersDrawnRef.current.length - 1] || null,
                            winHistory: winHistoryRef.current
                        }
                    });
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Host subscribed
                }
            });

        return () => {
            if (drawIntervalRef.current) clearInterval(drawIntervalRef.current);
            supabase.removeChannel(channel);
        };
    }, [roomId]);

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
            endGame,
            setVerificationPopup,
            setDrawInterval: setDrawIntervalSeconds,
            setDrawIntervalSeconds, // Alias for HostRoom.jsx compatibility
            removePlayer: (playerId: string) => {
                const player = playersRef.current.find(p => p.id === playerId);
                if (!player) return;

                // Release set if any
                if (player.setId !== -1) {
                    const updatedSets = availableSetsRef.current.map(s => s.id === player.setId ? { ...s, isTaken: false } : s);
                    setAvailableSets(updatedSets);
                    availableSetsRef.current = updatedSets;
                }

                // Remove player
                const updatedPlayers = playersRef.current.filter(p => p.id !== playerId);
                setPlayers(updatedPlayers);

                // Broadcast
                channelRef.current?.send({
                    type: 'broadcast',
                    event: 'roomDataSync',
                    payload: {
                        gameState: gameStateRef.current,
                        numbersDrawn: numbersDrawnRef.current,
                        players: updatedPlayers,
                        availableSets: availableSetsRef.current,
                        currentNumber: numbersDrawnRef.current[numbersDrawnRef.current.length - 1] || null,
                        winHistory: winHistoryRef.current
                    }
                });

                // Optionally send specific kick event
                /*
                channelRef.current?.send({
                    type: 'broadcast',
                    event: 'playerRemoved',
                    payload: { playerId }
                });
                */
            }
        }
    };
};
