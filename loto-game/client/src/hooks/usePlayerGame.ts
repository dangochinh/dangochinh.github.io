import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// Types (should share with useHostGame but for now redefine or use any if loose)
export interface Player {
    id: string;
    name: string;
    isReady: boolean;
    setId: number;
    tickets: any[]; // TicketSet
    joinedAt?: string;
}

export interface TicketSetInfo {
    id: number;
    name: string;
    color: string;
    data: any[]; // TicketSet
    isTaken: boolean;
}

export type GameState = 'WAITING' | 'PLAYING' | 'PAUSED' | 'ENDED';

export const usePlayerGame = (roomId: string | undefined, playerName: string | undefined) => {
    const [gameState, setGameState] = useState<GameState>('WAITING');
    const [availableSets, setAvailableSets] = useState<TicketSetInfo[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [isReady, setIsReady] = useState<boolean>(false);
    const [numbersDrawn, setNumbersDrawn] = useState<number[]>([]);
    const [currentNumber, setCurrentNumber] = useState<number | null>(null);
    const [winHistory, setWinHistory] = useState<any[]>([]);
    const [mySetId, setMySetId] = useState<number | null>(null);
    const [myTickets, setMyTickets] = useState<any[] | null>(null);
    const [error] = useState<string | null>(null);
    const [lastEvent, setLastEvent] = useState<any>(null); // For toasts/alerts

    const channelRef = useRef<RealtimeChannel | null>(null);
    const myIdRef = useRef<string | null>(null);
    const hostFoundRef = useRef<boolean>(false);

    // Initialize my ID
    useEffect(() => {
        const generateUUID = () => {
            if (window.crypto && window.crypto.randomUUID) {
                return window.crypto.randomUUID();
            }
            // Fallback
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

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

        channel
            .on('broadcast', { event: 'roomDataSync' }, ({ payload }) => {
                hostFoundRef.current = true;
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
                    if (!payload.success) {
                        alert(`LỖI: ${payload.message}`); // Replace with better UI later
                    }
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
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [roomId, playerName]);

    useEffect(() => {
        if (roomId && playerName) {
            joinRoom();
        }
    }, [roomId, playerName, joinRoom]);


    const selectTicketSet = (setId: number) => {
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
            selectTicketSet,
            toggleReady,
            claimBingo,
            closeVerificationPopup
        }
    };
};
