import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getAllTicketSets } from '../utils/ticketGenerator';
import { checkForBingo, TicketSet } from '../utils/gameLogic';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Player {
    id: string;
    name: string;
    setId: number;
    tickets: TicketSet;
    isReady: boolean;
    joinedAt: string;
}

export interface WinRecord {
    name: string;
    timestamp: Date | string;
    round: number;
    reason: 'BINGO' | 'KINH_SAI';
    type: 'win' | 'fail';
    players?: Player[];
    failures?: WinRecord[];
}

export interface VerificationPopup {
    playerName: string;
    success: boolean;
    message: string;
    markedNumbers: number[];
    drawnNumbers: number[];
}

export interface TicketSetInfo {
    id: number;
    name: string;
    color: string;
    data: TicketSet;
    isTaken: boolean;
}

export type GameState = 'WAITING' | 'PLAYING' | 'PAUSED' | 'ENDED';

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
            data: set.data as TicketSet,
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

            setVerificationPopup({
                playerName: player.name,
                success: true,
                message: 'Player has BINGO!',
                markedNumbers, // from client claim
                drawnNumbers: numbersDrawnRef.current
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
            // We don't verify update winHistory for fails directly usually, but we track failures
            // in failuresRef to attach to the eventual winner.

            setVerificationPopup({
                playerName: player.name,
                success: false,
                message: 'False Claim (Kinh Sai)!',
                markedNumbers,
                drawnNumbers: numbersDrawnRef.current
            });

            broadcast('verificationResult', {
                success: false,
                playerId: player.id,
                message: 'KINH SAI! Phạt đi!'
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
            .on('broadcast', { event: 'playerJoined' }, ({ payload }) => {
                const newPlayer: Player = { ...payload, isReady: false, tickets: [], joinedAt: new Date().toISOString() };

                // Assign a set if available
                const setArg = availableSetsRef.current.find(s => !s.isTaken);
                if (setArg) {
                    newPlayer.setId = setArg.id;
                    newPlayer.tickets = setArg.data;

                    // Update available sets locally
                    setAvailableSets(prev => prev.map(s => s.id === setArg.id ? { ...s, isTaken: true } : s));

                    // Send set info back to player
                    channel.send({
                        type: 'broadcast',
                        event: 'assignSet',
                        payload: { playerId: newPlayer.id, set: setArg }
                    });
                }

                setPlayers(prev => [...prev, newPlayer]);

                // Sync current state to new player
                channel.send({
                    type: 'broadcast',
                    event: 'syncState',
                    payload: {
                        gameState: gameStateRef.current,
                        numbersDrawn: numbersDrawnRef.current,
                        players: [...playersRef.current, newPlayer],
                        availableSets: availableSetsRef.current // Send updated availability
                    }
                });
            })
            .on('broadcast', { event: 'playerReady' }, ({ payload }) => {
                setPlayers(prev => prev.map(p => p.id === payload.playerId ? { ...p, isReady: payload.isReady } : p));
            })
            .on('broadcast', { event: 'kinh' }, ({ payload }) => {
                const { playerId, markedNumbers } = payload;
                verifyKinh(playerId, markedNumbers);
            })
            .on('broadcast', { event: 'requestSet' }, () => {
                // Handle set change request if we implement it
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
            setDrawInterval: setDrawIntervalSeconds
        }
    };
};
