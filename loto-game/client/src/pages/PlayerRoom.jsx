import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import Ticket from '../components/Ticket';
import clsx from 'clsx';

const PlayerRoom = () => {
    const socket = useSocket();
    const location = useLocation();
    const navigate = useNavigate();
    const { roomId, name, initialRoomData } = location.state || {};

    const [gameState, setGameState] = useState(initialRoomData?.gameState || 'WAITING');
    const [availableSets, setAvailableSets] = useState(initialRoomData?.availableSets || []);
    const [myTickets, setMyTickets] = useState(null);
    const [markedNumbers, setMarkedNumbers] = useState([]);
    const [currentNumber, setCurrentNumber] = useState(initialRoomData?.currentNumber || null);
    const [drawnHistory, setDrawnHistory] = useState(initialRoomData?.numbersDrawn || []);
    const [winHistory, setWinHistory] = useState(initialRoomData?.winHistory || []);
    const [showHistory, setShowHistory] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const [isSelecting, setIsSelecting] = useState(false);

    useEffect(() => {
        if (!socket || !roomId) {
            navigate('/');
            return;
        }

        // Listeners
        socket.on('setsUpdated', (sets) => setAvailableSets(sets));

        socket.on('numberDrawn', ({ number, history }) => {
            setCurrentNumber(number);
            setDrawnHistory(history);
        });

        socket.on('gameStateChanged', (state) => setGameState(state));

        socket.on('gameEnded', ({ winner, reason }) => {
            alert(reason === 'BINGO' ? `BINGO! Winner: ${winner}` : 'Game Over');
            setGameState('ENDED');
        });

        socket.on('gameRestarted', () => {
            setGameState('WAITING');
            setMarkedNumbers([]);
            setCurrentNumber(null);
            setDrawnHistory([]);
            setIsReady(false); // Reset ready state
            if (data?.winHistory) setWinHistory(data.winHistory);
            alert('New Game Started! Please choose your ticket.');
        });

        socket.on('gameEnded', ({ winner, reason, winHistory }) => {
            alert(reason === 'BINGO' ? `BINGO! Winner: ${winner}` : 'Game Over');
            setGameState('ENDED');
            if (winHistory) setWinHistory(winHistory);
        });

        return () => {
            socket.off('setsUpdated');
            socket.off('numberDrawn');
            socket.off('gameStateChanged');
            socket.off('gameEnded');
            socket.off('gameRestarted');
        }
    }, [socket, roomId, navigate]);

    const selectSet = (setId) => {
        setIsSelecting(true);
        socket.emit('selectSet', { roomId, setId }, (res) => {
            setIsSelecting(false);
            if (res.error) {
                alert(res.error);
            } else {
                setMyTickets(res.tickets);
            }
        });
    };

    const handleNumberClick = (num) => {
        if (gameState !== 'PLAYING') return;

        if (drawnHistory.includes(num)) {
            if (!markedNumbers.includes(num)) {
                setMarkedNumbers(prev => [...prev, num]);
            }
        }
    };

    const toggleReady = () => {
        socket.emit('toggleReady', { roomId }, (res) => {
            if (res.success) {
                setIsReady(res.isReady);
            } else {
                alert(res.error || 'Failed to toggle ready');
            }
        });
    };

    const changeTicket = () => {
        // Simple client-side reset? No, need to release on server?
        // Server selectSet handles releasing old set if we pick a new one. 
        // But for UI flow, let's just reset local state to allow picking again.
        // Or strictly call text "Change Number" implies picking new one.
        // We can just unset myTickets and let them pick again.
        // Ideally we should tell server we "unselected" but selectSet overwrites anyway.
        setMyTickets(null);
        setIsReady(false);
        // Note: The previous set remains "taken" until we select a NEW one in selectSet logic. 
        // Improvement: We could emit 'releaseSet' but for now standard overwrite is fine.
    };

    if (!roomId) return null;

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 pb-20">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 bg-slate-800 p-4 shadow-md z-10 flex justify-between items-center">
                <div className="font-bold">Room: {roomId}</div>
                <div className="flex items-center gap-4">
                    <button onClick={() => setShowHistory(!showHistory)} className="text-xs px-2 py-1 bg-slate-700 rounded border border-slate-600">
                        {showHistory ? 'Hide History' : '🏆 History'}
                    </button>
                    <div className="font-bold text-violet-400">{gameState}</div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="font-bold">{name}</div>
                    {myTickets && (
                        <div className={clsx("text-xs font-bold", isReady ? "text-green-400" : "text-yellow-400")}>
                            {isReady ? "READY" : "NOT READY"}
                        </div>
                    )}
                </div>
            </div>

            {/* History Modal/Overlay */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-yellow-400">🏆 Hall of Fame</h3>
                            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {winHistory.length > 0 ? winHistory.slice().reverse().map((win, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded">
                                    <div>
                                        <span className="font-bold text-yellow-400 mr-2">#{win.round}</span>
                                        <span className="font-bold text-white">{win.name}</span>
                                    </div>
                                    <span className="text-xs text-slate-400">{new Date(win.timestamp).toLocaleTimeString()}</span>
                                </div>
                            )) : (
                                <div className="text-center text-slate-500 py-8">No winners yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-20 max-w-lg mx-auto">
                {/* Current Number Display */}
                {/* Current Number Display */}
                {gameState === 'PLAYING' && (
                    <div className="mb-6 flex justify-center sticky top-20 z-10">
                        <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-full backdrop-blur-sm border border-slate-600 overflow-x-auto max-w-full">
                            {/* Previous */}
                            <div className="flex gap-2 opacity-60">
                                {Array.from({ length: 5 }).map((_, i) => {
                                    const idx = drawnHistory.length - (6 - i);
                                    if (idx < 0) return null;
                                    return (
                                        <div key={i} className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-500">
                                            <span className="text-sm text-slate-400">{drawnHistory[idx]}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Current */}
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-lg ring-4 ring-white/10 animate-pulse flex-shrink-0">
                                <span className="text-4xl font-bold">{currentNumber || '-'}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* State: Selecting Ticket */}
                {!myTickets ? (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-center">Select Your Ticket Set</h2>
                        <div className="grid grid-cols-5 gap-3">
                            {availableSets.map((set) => (
                                <button
                                    key={set.id}
                                    disabled={set.isTaken || isSelecting}
                                    onClick={() => selectSet(set.id)}
                                    className={clsx(
                                        "p-4 rounded-lg font-bold text-lg transition-all shadow-md",
                                        set.isTaken
                                            ? "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                                            : "bg-gradient-to-br from-blue-500 to-cyan-500 hover:scale-105 hover:from-blue-400 hover:to-cyan-400 text-white"
                                    )}
                                >
                                    {set.id}
                                </button>
                            ))}
                        </div>
                        {availableSets.length === 0 && (
                            <div className="text-center text-slate-500 mt-4">
                                Loading sets...
                            </div>
                        )}
                    </div>
                ) : (
                    /* State: Playing OR Ready to Play */
                    <div className="space-y-6">
                        {/* Status Bar for Player */}
                        {gameState === 'WAITING' && (
                            <div className="bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-slate-700">
                                <div>
                                    <p className="text-slate-400 text-sm">Ticket Selected</p>
                                    <p className="font-bold text-lg">Set #{initialRoomData?.players?.find(p => p.id === socket?.id)?.setId || '?'}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={changeTicket}
                                        disabled={isReady}
                                        className={clsx("px-4 py-2 rounded font-bold text-sm bg-slate-700 hover:bg-slate-600", isReady && "opacity-50 cursor-not-allowed")}
                                    >
                                        Change
                                    </button>
                                    <button
                                        onClick={toggleReady}
                                        className={clsx(
                                            "px-6 py-2 rounded font-bold transition-all shadow-lg",
                                            isReady
                                                ? "bg-green-600 hover:bg-green-700"
                                                : "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 animate-pulse"
                                        )}
                                    >
                                        {isReady ? "READY!" : "I'M READY"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {myTickets.map((ticketData, idx) => (
                            <Ticket
                                key={idx}
                                data={ticketData}
                                markedNumbers={markedNumbers}
                                onNumberClick={handleNumberClick}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerRoom;
