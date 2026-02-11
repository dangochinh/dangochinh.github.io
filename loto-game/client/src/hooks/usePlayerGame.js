import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export const usePlayerGame = (roomId, playerName) => {
    const [gameState, setGameState] = useState('WAITING');
    const [availableSets, setAvailableSets] = useState([]);
    const [players, setPlayers] = useState([]);
    const [isReady, setIsReady] = useState(false);
    const [numbersDrawn, setNumbersDrawn] = useState([]);
    const [currentNumber, setCurrentNumber] = useState(null);
    const [winHistory, setWinHistory] = useState([]);
    const [mySetId, setMySetId] = useState(null);
    const [myTickets, setMyTickets] = useState(null);
    const [error, setError] = useState(null);

    // UI Events
    const [lastEvent, setLastEvent] = useState(null); // For showing toasts/alerts/modals

    const channelRef = useRef(null);
    const myIdRef = useRef(null); // Store my generated UUID
    const hostFoundRef = useRef(false);

    // Initialize my ID
    useEffect(() => {
        // Simple UUID generator fallback
        const generateUUID = () => {
            if (window.crypto && window.crypto.randomUUID) {
                return window.crypto.randomUUID();
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };

        // Retrieve or generate ID
        let id = sessionStorage.getItem('bingo_player_id');
        if (!id) {
            id = generateUUID();
            sessionStorage.setItem('bingo_player_id', id);
        }
        myIdRef.current = id;
    }, []);

    const broadcast = useCallback((event, payload) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: event,
                payload: { ...payload, playerId: myIdRef.current }
            });
        }
    }, []);

    useEffect(() => {
        if (!roomId || !playerName) return;

        const channel = supabase.channel(`room:${roomId}`, {
            config: { broadcast: { self: true } }
        });

        channel
            .on('broadcast', { event: 'playerJoined' }, ({ payload }) => {
                setPlayers(payload);
            })
            .on('broadcast', { event: 'roomDataSync' }, ({ payload }) => {
                hostFoundRef.current = true;
                // Determine if this sync is for me or general
                // For simplicity, we just sync everything
                setGameState(payload.gameState);
                setAvailableSets(payload.availableSets);
                setPlayers(payload.players);
                setNumbersDrawn(payload.numbersDrawn);
                setCurrentNumber(payload.currentNumber);
                setWinHistory(payload.winHistory);

                // My state
                const me = payload.players.find(p => p.id === myIdRef.current);
                if (me) {
                    setMySetId(me.setId);
                    setIsReady(me.isReady);
                    setMyTickets(me.tickets);
                }
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
                const me = payload.find(p => p.id === myIdRef.current);
                if (me) {
                    setMySetId(me.setId);
                    setIsReady(me.isReady);
                    setMyTickets(me.tickets);
                }
            })
            .on('broadcast', { event: 'selectSetSuccess' }, ({ payload }) => {
                if (payload.playerId === myIdRef.current) {
                    setMyTickets(payload.tickets);
                    // Set ID handled by playerUpdated usually
                }
            })
            .on('broadcast', { event: 'selectSetError' }, ({ payload }) => {
                if (payload.playerId === myIdRef.current) {
                    alert(payload.message);
                }
            })
            .on('broadcast', { event: 'gameEnded' }, ({ payload }) => {
                setGameState('ENDED'); // Update game state first
                setLastEvent({ type: 'gameEnded', data: payload });
                // Sync winHistory from host
                if (payload.winHistory) {
                    setWinHistory(payload.winHistory);
                }
            })
            .on('broadcast', { event: 'gameRestarted' }, ({ payload }) => {
                setGameState(payload.gameState);
                setPlayers(payload.players);
                setAvailableSets(payload.availableSets);
                setWinHistory(payload.winHistory || []);
                setNumbersDrawn([]);
                setCurrentNumber(null);
                setIsReady(false);
                // Keep tickets? Yes usually
            })
            .on('broadcast', { event: 'kinhFailed' }, ({ payload }) => {
                setLastEvent({ type: 'kinhFailed', data: payload });
                // Sync winHistory from host
                if (payload.winHistory) {
                    setWinHistory(payload.winHistory);
                }
            })
            .on('broadcast', { event: 'unselectSetSuccess' }, ({ payload }) => {
                if (payload.playerId === myIdRef.current) {
                    console.log("Set unselected successfully");
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log("Player subscribed to room:", roomId);
                    channelRef.current = channel;

                    // Request Join
                    channel.send({
                        type: 'broadcast',
                        event: 'joinRequest',
                        payload: { id: myIdRef.current, name: playerName }
                    });

                    // Timeout check
                    setTimeout(() => {
                        if (!hostFoundRef.current) {
                            setError("Room verification failed. Please check the Room ID or ask the Host if they are online.");
                        }
                    }, 3000);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, playerName, broadcast]);

    // Actions
    const selectSet = (setId) => {
        broadcast('selectSet', { setId });
    };

    const toggleReady = () => {
        broadcast('toggleReady', {});
    };

    const sendKinh = (markedNumbers) => {
        broadcast('kinh', { markedNumbers });
    };

    const leaveSeat = () => {
        broadcast('unselectSet', {});
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
        lastEvent,
        error,
        actions: {
            selectSet,
            toggleReady,
            sendKinh,
            leaveSeat
        }
    };
};
