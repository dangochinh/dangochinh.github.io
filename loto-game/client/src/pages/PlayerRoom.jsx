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
    const [mySetId, setMySetId] = useState(initialRoomData?.players?.find(p => p.id === socket?.id)?.setId || null);
    const [myTickets, setMyTickets] = useState(null);
    const [myTicketColor, setMyTicketColor] = useState(null);
    const [markedNumbers, setMarkedNumbers] = useState([]);
    const [currentNumber, setCurrentNumber] = useState(initialRoomData?.currentNumber || null);

    // ... (rest of listeners) ...


    const [drawnHistory, setDrawnHistory] = useState(initialRoomData?.numbersDrawn || []);
    const [winHistory, setWinHistory] = useState(initialRoomData?.winHistory || []);
    const [showHistory, setShowHistory] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [kinhClickCount, setKinhClickCount] = useState(0);
    const [kinhClickTimer, setKinhClickTimer] = useState(null);
    const [showDrawnNumbers, setShowDrawnNumbers] = useState(false);

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

        socket.on('kinhFailed', ({ playerName, winHistory }) => {
            alert(`❌ Kinh sai! ${playerName} made an incorrect claim.`);
            if (winHistory) setWinHistory(winHistory);
        });

        return () => {
            socket.off('setsUpdated');
            socket.off('numberDrawn');
            socket.off('gameStateChanged');
            socket.off('gameEnded');
            socket.off('gameRestarted');
            socket.off('kinhFailed');
        }
    }, [socket, roomId, navigate]);

    const selectSet = (setId) => {
        console.log('Attempting to select set:', setId);
        setIsSelecting(true);
        socket.emit('selectSet', { roomId, setId }, (res) => {
            console.log('selectSet response:', res);
            setIsSelecting(false);
            if (res.error) {
                console.error('Selection error:', res.error);
                alert(res.error);
            } else {
                console.log('Tickets received:', res.tickets);
                setMyTickets(res.tickets);
                setMySetId(setId);
                // Find and store the color
                const selectedSet = availableSets.find(s => s.id === setId);
                if (selectedSet) setMyTicketColor(selectedSet.color);
            }
        });
    };

    const handleNumberClick = (num) => {
        // Allow marking in any state (not just PLAYING)
        // Toggle marking - allow marking/unmarking any number
        if (markedNumbers.includes(num)) {
            setMarkedNumbers(prev => prev.filter(n => n !== num));
        } else {
            setMarkedNumbers(prev => [...prev, num]);
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
        setMyTickets(null);
        setMySetId(null);
        setIsReady(false);
    };

    const handleKinh = () => {
        if (markedNumbers.length === 0) {
            alert('Please mark some numbers first!');
            return;
        }

        // Triple-click mechanism
        const newCount = kinhClickCount + 1;
        setKinhClickCount(newCount);

        // Clear existing timer
        if (kinhClickTimer) {
            clearTimeout(kinhClickTimer);
        }

        if (newCount >= 3) {
            // Submit Kinh after 3 clicks
            setKinhClickCount(0);
            setKinhClickTimer(null);

            socket.emit('kinh', { roomId, markedNumbers }, (res) => {
                if (res.error) {
                    alert(`Error: ${res.error}`);
                } else if (res.success) {
                    alert('🎉 BINGO! You won!');
                } else {
                    alert(`❌ Kinh sai! ${res.message || 'Your claim is incorrect.'}`);
                }
            });
        } else {
            // Reset counter after 2 seconds if not clicked again
            const timer = setTimeout(() => {
                setKinhClickCount(0);
            }, 2000);
            setKinhClickTimer(timer);
        }
    };

    const autoMarkDrawnNumbers = () => {
        // Auto-tick all drawn numbers that are in the player's tickets
        const numbersInTickets = [];
        if (myTickets) {
            myTickets.forEach(ticket => {
                ticket.forEach(row => {
                    row.forEach(num => {
                        if (num !== 0 && drawnHistory.includes(num)) {
                            numbersInTickets.push(num);
                        }
                    });
                });
            });
        }
        setMarkedNumbers(numbersInTickets);
        setShowDrawnNumbers(false);
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

            {/* Drawn Numbers Popup */}
            {showDrawnNumbers && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-yellow-400">📋 Drawn Numbers ({drawnHistory.length})</h3>
                            <button onClick={() => setShowDrawnNumbers(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-10 gap-2">
                                {drawnHistory.map((num, idx) => (
                                    <div key={idx} className="aspect-square flex items-center justify-center rounded bg-violet-600 text-white font-bold">
                                        {num}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4">
                            <button
                                onClick={autoMarkDrawnNumbers}
                                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-lg font-bold"
                            >
                                ✓ Auto Mark My Numbers
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-20 max-w-lg mx-auto">
                {/* Current Number Display */}
                {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
                    <div className="mb-6 flex justify-center sticky top-20 z-10">
                        <div className="flex items-center gap-2 sm:gap-4 bg-slate-800/80 p-3 sm:p-4 rounded-full backdrop-blur-sm border border-slate-600 overflow-x-auto max-w-full">
                            {/* Previous */}
                            <div className="flex gap-1 sm:gap-2 opacity-60">
                                {Array.from({ length: 5 }).map((_, i) => {
                                    const idx = drawnHistory.length - (6 - i);
                                    if (idx < 0) return null;
                                    return (
                                        <div key={i} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-500">
                                            <span className="text-xs sm:text-sm text-slate-400">{drawnHistory[idx]}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Current */}
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-lg ring-4 ring-white/10 animate-pulse flex-shrink-0">
                                <span className="text-2xl sm:text-3xl font-bold">{currentNumber || (gameState === 'PAUSED' ? 'II' : '-')}</span>
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
                                    <p className="font-bold text-lg">Set #{mySetId || '?'}</p>
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
                                color={myTicketColor}
                            />
                        ))}

                        {/* Kinh Button - Always visible when player has tickets */}
                        {myTickets && (
                            <div className="fixed bottom-0 left-0 right-0 bg-slate-800/95 p-4 border-t border-slate-700 backdrop-blur-sm z-20">
                                <div className="max-w-lg mx-auto flex gap-3 items-center">
                                    <div className="flex-1 text-sm text-slate-300">
                                        Marked: <span className="font-bold text-yellow-400">{markedNumbers.length}</span> numbers
                                    </div>
                                    <button
                                        onClick={handleKinh}
                                        disabled={markedNumbers.length === 0 || (gameState !== 'PLAYING' && gameState !== 'PAUSED')}
                                        className={clsx(
                                            "px-8 py-3 rounded-lg font-bold text-lg transition-all shadow-lg relative",
                                            markedNumbers.length > 0 && (gameState === 'PLAYING' || gameState === 'PAUSED')
                                                ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white animate-pulse"
                                                : "bg-slate-700 text-slate-500 cursor-not-allowed"
                                        )}
                                    >
                                        🎯 KINH! {kinhClickCount > 0 && `(${kinhClickCount}/3)`}
                                    </button>
                                    <button
                                        onClick={() => setShowDrawnNumbers(true)}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-sm"
                                    >
                                        📋 Drawn Numbers
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerRoom;
