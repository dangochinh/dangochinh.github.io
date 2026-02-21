import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Player, TicketSetInfo, GameState, TicketSet, WinRecord } from '../types';
import { generateUUID } from '../utils/uuid';

export const usePlayerGame = (roomId: string | undefined, playerName: string | undefined) => {
    const [gameState, setGameState] = useState<GameState>('WAITING');
    const [availableSets, setAvailableSets] = useState<TicketSetInfo[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [isReady, setIsReady] = useState<boolean>(false);
    const [numbersDrawn, setNumbersDrawn] = useState<number[]>([]);
    const [currentNumber, setCurrentNumber] = useState<number | null>(null);
    const [winHistory, setWinHistory] = useState<WinRecord[]>([]);
    const [mySetId, setMySetId] = useState<number | null>(null);
    const [myTickets, setMyTickets] = useState<TicketSet | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [lastEvent, setLastEvent] = useState<any>(null); // For toasts/alerts
    const [isHostConnected, setIsHostConnected] = useState<boolean>(true);
    const [isConnecting, setIsConnecting] = useState<boolean>(true);
    const [coWinners, setCoWinners] = useState<string[]>([]); // Names of co-Bingo winners

    const channelRef = useRef<RealtimeChannel | null>(null);
    const myIdRef = useRef<string | null>(null);
    const hostFoundRef = useRef<boolean>(false);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize my ID
    useEffect(() => {
        let id = sessionStorage.getItem('bingo_player_id');
        if (!id) {
            id = generateUUID();
            sessionStorage.setItem('bingo_player_id', id);
        }
        myIdRef.current = id;
    }, []);

    const joinRoom = useCallback(() => {
        if (!roomId || !playerName || !myIdRef.current) return;

        if (channelRef.current) {
            // Already joined?
            // return;
        }

        const channel = supabase.channel(`room:${roomId}`, {
            config: { presence: { key: myIdRef.current } }
        });

        channelRef.current = channel;

        // Start connection timeout
        connectionTimeoutRef.current = setTimeout(() => {
            if (!hostFoundRef.current) {
                setError("Không tìm thấy phòng hoặc Chủ phòng không online!");
                setIsConnecting(false);
            }
        }, 5000);

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const hasHost = 'host' in state; // Host uses key 'host'
                setIsHostConnected(hasHost);

                // If we found host via presence, ensuring we don't timeout if roomDataSync is slightly delayed
                if (hasHost) {
                    // hostFoundRef.current = true; // Wait for data sync to be sure? No, presence is enough for "Room Exists" check usually
                }
            })
            .on('broadcast', { event: 'roomDataSync' }, ({ payload }) => {
                hostFoundRef.current = true;
                if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
                setIsHostConnected(true);
                setIsConnecting(false);
                setGameState(payload.gameState);
                setAvailableSets(payload.availableSets);
                setPlayers(payload.players);
                setNumbersDrawn(payload.numbersDrawn);
                setCurrentNumber(payload.currentNumber);
                setWinHistory(payload.winHistory);

                const me = payload.players.find((p: Player) => p.id === myIdRef.current);
                if (me) {
                    setMySetId(me.setId);
                    setIsReady(me.isReady);
                    setMyTickets(me.tickets);
                }
            })
            .on('broadcast', { event: 'playerJoined' }, ({ payload }) => {
                setPlayers(payload); // Payload is list of players? Or single player? Code suggests list.
            })
            .on('broadcast', { event: 'numberDrawn' }, ({ payload }) => {
                setNumbersDrawn(payload.history);
                setCurrentNumber(payload.number);
            })
            .on('broadcast', { event: 'gameStateChanged' }, ({ payload }) => {
                setGameState(payload);
            })
            .on('broadcast', { event: 'gameEnded' }, ({ payload }) => {
                setGameState('ENDED');
                setLastEvent({ type: 'gameEnded', data: payload });
                if (payload.winRecord) {
                    setWinHistory(prev => [...prev, payload.winRecord]);
                }
                setCoWinners([]); // Reset after game ends
            })
            .on('broadcast', { event: 'bingoConfirmed' }, ({ payload }) => {
                setGameState('BINGO_WINDOW');
                setLastEvent({ type: 'bingoConfirmed', data: payload });
                setCoWinners([]); // Fresh window
            })
            .on('broadcast', { event: 'coWinnerAdded' }, ({ payload }) => {
                setCoWinners(prev => [...prev, payload.name]);
            })
            .on('broadcast', { event: 'gameRestarted' }, ({ payload }) => {
                setGameState(payload.gameState);
                setPlayers(payload.players);
                setWinHistory(payload.winHistory);
                setNumbersDrawn([]);
                setCurrentNumber(null);
                setLastEvent(null);
                setCoWinners([]);
                const me = payload.players.find((p: Player) => p.id === myIdRef.current);
                if (me) {
                    setIsReady(me.isReady);
                }
            })
            .on('broadcast', { event: 'joinRejected' }, ({ payload }) => {
                if (payload.playerId === myIdRef.current) {
                    setGameState(payload.gameState || 'PLAYING');
                    setLastEvent({ type: 'joinRejected', data: payload });
                }
            })
            .on('broadcast', { event: 'setsUpdated' }, ({ payload }) => {
                setAvailableSets(payload);
            })
            .on('broadcast', { event: 'playerUpdated' }, ({ payload }) => {
                setPlayers(payload);
                const me = payload.find((p: Player) => p.id === myIdRef.current);
                if (me) {
                    setMySetId(me.setId);
                    setIsReady(me.isReady);
                    setMyTickets(me.tickets);
                }
            })
            .on('broadcast', { event: 'verificationResult' }, ({ payload }) => {
                if (payload.playerId === myIdRef.current) {
                    // Handle verification result for me
                    // PlayerRoom handles UI based on lastEvent
                }
                setLastEvent({ type: 'verification', ...payload });
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Join request
                    channel.send({
                        type: 'broadcast',
                        event: 'requestJoin',
                        payload: {
                            id: myIdRef.current,
                            name: playerName
                        }
                    });
                }
            });

        return () => {
            if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [roomId, playerName]);

    useEffect(() => {
        if (roomId && playerName) {
            joinRoom();
        }
    }, [roomId, playerName, joinRoom]);


    const selectSet = (setId: number) => {
        if (!channelRef.current) return;
        channelRef.current.send({
            type: 'broadcast',
            event: 'requestSet',
            payload: { playerId: myIdRef.current, setId }
        });
    };

    const toggleReady = () => {
        if (!channelRef.current) return;
        channelRef.current.send({
            type: 'broadcast',
            event: 'toggleReady',
            payload: { playerId: myIdRef.current, isReady: !isReady }
        });
    };

    const claimBingo = (markedNumbers: number[]) => {
        if (!channelRef.current) return;
        channelRef.current.send({
            type: 'broadcast',
            event: 'kinh',
            payload: { playerId: myIdRef.current, markedNumbers }
        });
    };

    const leaveSeat = () => {
        if (!channelRef.current) return;
        channelRef.current.send({
            type: 'broadcast',
            event: 'unselectSet',
            payload: { playerId: myIdRef.current }
        });
    };

    const closeVerificationPopup = () => {
        setLastEvent(null);
    };

    return {
        gameState,
        availableSets,
        players,
        isReady,
        numbersDrawn,
        currentNumber,
        winHistory,
        mySetId,
        myTickets,
        error,
        lastEvent,
        actions: {
            selectSet,
            toggleReady,
            claimBingo,
            sendKinh: claimBingo, // Alias for backward compatibility if needed
            leaveSeat,
            closeVerificationPopup
        },
        isHostConnected,
        isConnecting,
        coWinners
    };
};
