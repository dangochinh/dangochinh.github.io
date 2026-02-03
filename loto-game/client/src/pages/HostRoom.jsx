import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import clsx from 'clsx';

const HostRoom = () => {
    const socket = useSocket();
    const location = useLocation();
    const navigate = useNavigate();
    const roomId = location.state?.roomId;

    const [players, setPlayers] = useState([]);
    const [gameState, setGameState] = useState('WAITING');
    const [numbersDrawn, setNumbersDrawn] = useState([]);
    const [currentNumber, setCurrentNumber] = useState(null);
    const [lastWinner, setLastWinner] = useState(null);
    const [voiceLang, setVoiceLang] = useState('vi');
    const [winHistory, setWinHistory] = useState([]);
    const [showToast, setShowToast] = useState(false);
    const [verificationPopup, setVerificationPopup] = useState(null);
    const [showAllTickets, setShowAllTickets] = useState(false);
    const [drawIntervalSeconds, setDrawIntervalSeconds] = useState(3);

    useEffect(() => {
        if (!socket || !roomId) {
            navigate('/');
            return;
        }

        socket.on('playerJoined', (updatedPlayers) => {
            setPlayers(updatedPlayers);
        });

        socket.on('playerUpdated', (updatedPlayers) => {
            setPlayers(updatedPlayers);
        });

        socket.on('numberDrawn', ({ number, history }) => {
            setCurrentNumber(number);
            setNumbersDrawn(history);
            speakNumber(number);
        });

        socket.on('gameStateChanged', (state) => {
            setGameState(state);
        });

        socket.on('gameEnded', ({ winner, reason, fullHistory, winHistory }) => {
            setGameState('ENDED');
            setLastWinner(winner);
            if (fullHistory) setNumbersDrawn(fullHistory);
            if (winHistory) setWinHistory(winHistory);
        });

        socket.on('kinhFailed', ({ playerName, winHistory }) => {
            if (winHistory) setWinHistory(winHistory);
        });

        socket.on('kinhVerification', (data) => {
            setVerificationPopup(data);
        });

        socket.on('drawIntervalChanged', ({ drawIntervalSeconds }) => {
            setDrawIntervalSeconds(drawIntervalSeconds);
        });

        socket.on('gameRestarted', (data) => {
            setGameState('WAITING');
            setNumbersDrawn([]);
            setCurrentNumber(null);
            setLastWinner(null);
            // Optionally clear history or keep it? Requirement says "history bingo log"
            if (data.winHistory) setWinHistory(data.winHistory);
        })

        return () => {
            socket.off('playerJoined');
            socket.off('playerUpdated');
            socket.off('numberDrawn');
            socket.off('gameStateChanged');
            socket.off('gameEnded');
            socket.off('gameRestarted');
            socket.off('kinhFailed');
            socket.off('kinhVerification');
            socket.off('drawIntervalChanged');
        }
    }, [socket, roomId, navigate]);

    const speakNumber = (num) => {
        if ('speechSynthesis' in window) {
            const text = voiceLang === 'vi' ? `Số ${num}` : `Number ${num}`;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = voiceLang === 'vi' ? 'vi-VN' : 'en-US';

            const voices = window.speechSynthesis.getVoices();
            let selectedVoice;

            if (voiceLang === 'vi') {
                selectedVoice = voices.find(voice => voice.lang.includes('vi') || voice.lang.includes('VN'));
            } else {
                selectedVoice = voices.find(voice => voice.lang.includes('en-US') && !voice.name.includes('Zira'));
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }

            window.speechSynthesis.speak(utterance);
        }
    };

    const sendAction = (action) => {
        socket.emit('action', { roomId, action });
    };

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    };

    const exportHallOfFame = () => {
        const data = winHistory.map(game => ({
            Round: game.round,
            Winner: game.name,
            Timestamp: new Date(game.timestamp).toLocaleString(),
            Players: game.players ? game.players.map(p => `${p.name} (Set ${p.setId})`).join(', ') : 'N/A'
        }));

        const csv = [
            ['Round', 'Winner', 'Timestamp', 'Players'],
            ...data.map(row => [row.Round, row.Winner, row.Timestamp, row.Players])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hall-of-fame-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const removePlayer = (playerId) => {
        if (!window.confirm('Are you sure you want to remove this player?')) return;
        socket.emit('removePlayer', { roomId, playerId }, (res) => {
            if (res && res.error) {
                alert(res.error);
            }
        });
    };

    const closeVerificationPopup = () => {
        const wasKinhSai = verificationPopup && !verificationPopup.success;
        setVerificationPopup(null);
        // If kinh sai, resume the game
        if (wasKinhSai) {
            sendAction('RESUME');
        }
    };


    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-900 text-white">
            {/* Toast Notification */}
            {showToast && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg font-bold animate-fade-in">
                    ✓ Copied ID!
                </div>
            )}

            {/* Verification Popup */}
            {verificationPopup && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold">
                                {verificationPopup.success ? (
                                    <span className="text-green-400">✅ BINGO! - {verificationPopup.playerName}</span>
                                ) : (
                                    <span className="text-red-400">❌ KINH SAI - {verificationPopup.playerName}</span>
                                )}
                            </h3>
                            <button onClick={closeVerificationPopup} className="text-slate-400 hover:text-white text-2xl">✕</button>
                        </div>

                        {verificationPopup.message && (
                            <div className="mb-4 p-3 bg-red-900/50 rounded text-red-200 text-sm">
                                {verificationPopup.message}
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto space-y-4">
                            {verificationPopup.playerTickets.map((ticket, idx) => (
                                <div key={idx} className="border-2 border-slate-700 bg-slate-900/50 p-3 rounded-lg">
                                    <div className="text-sm text-slate-400 mb-2">Ticket {idx + 1}</div>
                                    <div className="flex flex-col gap-1">
                                        {ticket.map((row, rIdx) => (
                                            <div key={rIdx} className="grid grid-cols-9 gap-1">
                                                {row.map((num, cIdx) => {
                                                    const isMarked = verificationPopup.markedNumbers.includes(num) && num !== 0;
                                                    const isDrawn = verificationPopup.drawnNumbers.includes(num) && num !== 0;
                                                    return (
                                                        <div
                                                            key={`${rIdx}-${cIdx}`}
                                                            className={clsx(
                                                                "flex items-center justify-center font-bold text-sm rounded h-10",
                                                                num === 0 ? "invisible" : "",
                                                                isMarked && isDrawn ? "bg-green-500 text-white" :
                                                                    isMarked && !isDrawn ? "bg-red-500 text-white" :
                                                                        isDrawn ? "bg-blue-500/50 text-white" :
                                                                            "bg-slate-700 text-slate-300"
                                                            )}
                                                        >
                                                            {num !== 0 ? num : ''}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 flex gap-2 text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 bg-green-500 rounded"></div>
                                <span>Marked + Drawn</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 bg-red-500 rounded"></div>
                                <span>Marked (not drawn)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 bg-blue-500/50 rounded"></div>
                                <span>Drawn only</span>
                            </div>
                        </div>

                        <div className="mt-4">
                            <button
                                onClick={closeVerificationPopup}
                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 rounded-lg font-bold text-lg"
                            >
                                {verificationPopup.success ? 'Close' : 'Close & Resume Game'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* All Tickets Viewer Popup */}
            {showAllTickets && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-6xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-cyan-400">👁️ All Player Tickets</h3>
                            <button onClick={() => setShowAllTickets(false)} className="text-slate-400 hover:text-white text-2xl">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-6">
                            {players.map((player) => {
                                if (!player.tickets) return null;

                                // Check if player has bingo
                                let hasBingo = false;
                                let bingoInfo = null;
                                for (let ticketIdx = 0; ticketIdx < player.tickets.length; ticketIdx++) {
                                    const ticket = player.tickets[ticketIdx];
                                    for (let r = 0; r < 3; r++) {
                                        let matches = 0;
                                        for (let c = 0; c < 9; c++) {
                                            const val = ticket[r][c];
                                            if (val !== 0 && numbersDrawn.includes(val)) {
                                                matches++;
                                            }
                                        }
                                        if (matches === 5) {
                                            hasBingo = true;
                                            bingoInfo = { ticketIdx, rowIdx: r };
                                            break;
                                        }
                                    }
                                    if (hasBingo) break;
                                }

                                return (
                                    <div key={player.id} className={clsx(
                                        "border-2 rounded-lg p-4",
                                        hasBingo ? "border-green-500 bg-green-900/20" : "border-slate-700 bg-slate-900/50"
                                    )}>
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-lg text-white">{player.name}</span>
                                                <span className="text-sm text-slate-400">Set #{player.setId}</span>
                                            </div>
                                            {hasBingo && (
                                                <span className="px-3 py-1 bg-green-500 text-white rounded-full text-sm font-bold animate-pulse">
                                                    ✅ BINGO!
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                            {player.tickets.map((ticket, tIdx) => (
                                                <div key={tIdx} className="border border-slate-700 bg-slate-800/50 p-2 rounded">
                                                    <div className="text-xs text-slate-400 mb-1">Ticket {tIdx + 1}</div>
                                                    <div className="flex flex-col gap-0.5">
                                                        {ticket.map((row, rIdx) => {
                                                            const isWinningRow = hasBingo && bingoInfo.ticketIdx === tIdx && bingoInfo.rowIdx === rIdx;
                                                            return (
                                                                <div key={rIdx} className={clsx(
                                                                    "grid grid-cols-9 gap-0.5",
                                                                    isWinningRow && "ring-2 ring-green-400 rounded"
                                                                )}>
                                                                    {row.map((num, cIdx) => {
                                                                        const isDrawn = num !== 0 && numbersDrawn.includes(num);
                                                                        return (
                                                                            <div
                                                                                key={`${rIdx}-${cIdx}`}
                                                                                className={clsx(
                                                                                    "flex items-center justify-center font-bold text-xs rounded h-7",
                                                                                    num === 0 ? "invisible" : "",
                                                                                    isDrawn ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-300"
                                                                                )}
                                                                            >
                                                                                {num !== 0 ? num : ''}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-4 flex gap-2 text-xs">
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 bg-violet-600 rounded"></div>
                                <span>Drawn</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-4 h-4 bg-slate-700 rounded"></div>
                                <span>Not drawn</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-slate-800 p-4 shadow-md flex justify-between items-center z-10">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
                        Room: <span onClick={copyRoomId} className="cursor-pointer font-mono text-white underline decoration-dashed underline-offset-4" title="Click to copy">{roomId}</span>
                    </h1>
                    <span className={clsx("px-3 py-1 rounded-full text-sm font-bold",
                        gameState === 'WAITING' ? "bg-yellow-500/20 text-yellow-400" :
                            gameState === 'PLAYING' ? "bg-green-500/20 text-green-400" :
                                gameState === 'PAUSED' ? "bg-orange-500/20 text-orange-400" :
                                    "bg-red-500/20 text-red-400"
                    )}>
                        {gameState}
                    </span>
                    <div className="flex bg-slate-700/50 rounded-lg p-0.5 border border-slate-600">
                        <button
                            onClick={() => setVoiceLang('vi')}
                            className={clsx("px-3 py-1.5 rounded font-bold text-xs transition-colors", voiceLang === 'vi' ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-slate-300")}
                        >
                            VI
                        </button>
                        <button
                            onClick={() => setVoiceLang('en')}
                            className={clsx("px-3 py-1.5 rounded font-bold text-xs transition-colors", voiceLang === 'en' ? "bg-slate-600 text-white shadow" : "text-slate-400 hover:text-slate-300")}
                        >
                            EN
                        </button>
                    </div>

                    {/* Draw Interval Control */}
                    <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-1.5 border border-slate-600">
                        <label className="text-xs text-slate-400">Interval (s):</label>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={drawIntervalSeconds}
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 3;
                                setDrawIntervalSeconds(val);
                            }}
                            onBlur={(e) => {
                                const val = Math.max(1, Math.min(60, parseInt(e.target.value) || 3));
                                socket.emit('setDrawInterval', { roomId, seconds: val }, (res) => {
                                    if (res && res.success) {
                                        setDrawIntervalSeconds(res.drawIntervalSeconds);
                                    }
                                });
                            }}
                            className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                        />
                    </div>

                    {/* View All Tickets Button */}
                    <button
                        onClick={() => setShowAllTickets(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-sm"
                    >
                        👁️ View Tickets
                    </button>
                </div>
                <div className="flex gap-2">
                    {gameState === 'WAITING' && (
                        <button
                            onClick={() => sendAction('START')}
                            disabled={players.length === 0 || !players.every(p => p.isReady)}
                            className={clsx(
                                "px-6 py-2 rounded-lg font-bold transition-all",
                                players.length > 0 && players.every(p => p.isReady)
                                    ? "bg-green-600 hover:bg-green-700 shadow-lg hover:scale-105"
                                    : "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                            )}
                        >
                            {players.length === 0 ? "Waiting for players..." : players.every(p => p.isReady) ? "Start Game" : `Waiting (${players.filter(p => p.isReady).length}/${players.length} Ready)`}
                        </button>
                    )}
                    {gameState === 'PLAYING' && (
                        <button onClick={() => sendAction('PAUSE')} className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold">Pause</button>
                    )}
                    {gameState === 'PAUSED' && (
                        <button onClick={() => sendAction('RESUME')} className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold">Resume</button>
                    )}
                    <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg">Exit</button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* Left: Drawn Numbers Board */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="flex justify-center mb-8">
                        {currentNumber && (
                            <div className="flex items-center gap-3 sm:gap-6">
                                <div className="flex gap-1 sm:gap-2 opacity-60">
                                    {Array.from({ length: 5 }).map((_, i) => {
                                        const idx = numbersDrawn.length - (6 - i); // 5 prev numbers
                                        if (idx < 0) return null;
                                        return (
                                            <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                                                <span className="text-sm sm:text-lg text-slate-400">{numbersDrawn[idx]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="relative animate-bounce">
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-2xl ring-4 ring-white/20">
                                        <span className="text-3xl sm:text-4xl md:text-5xl font-bold">{currentNumber}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {gameState === 'ENDED' && lastWinner && (
                            <div className="text-center mt-6">
                                <h2 className="text-4xl font-extrabold text-yellow-400 mb-2">BINGO!</h2>
                                <p className="text-2xl mb-8">Winner: {lastWinner}</p>

                                <button
                                    onClick={() => sendAction('RESTART')}
                                    className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 rounded-xl font-bold text-xl shadow-lg transform hover:scale-105 transition-all"
                                >
                                    Start New Game
                                </button>
                            </div>
                        )}

                    </div>

                    <div className="grid grid-cols-10 gap-2 max-w-4xl mx-auto mt-8">
                        {Array.from({ length: 90 }, (_, i) => i + 1).map(num => (
                            <div
                                key={num}
                                className={clsx(
                                    "aspect-square flex items-center justify-center rounded font-medium transition-all duration-500",
                                    numbersDrawn.includes(num)
                                        ? "bg-violet-600 text-white scale-105 shadow-lg shadow-violet-500/50"
                                        : "bg-slate-800 text-slate-500"
                                )}
                            >
                                {num}
                            </div>
                        ))}
                    </div>

                    {/* Hall of Fame - Moved to Bottom */}
                    <div className="mt-12 bg-slate-800/50 p-6 rounded-xl max-w-lg mx-auto border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-slate-300">🏆 Hall of Fame (Last 50)</h3>
                            {winHistory.length > 0 && (
                                <button
                                    onClick={exportHallOfFame}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                                >
                                    📥 Export CSV
                                </button>
                            )}
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {winHistory.length > 0 ? winHistory.slice().reverse().map((win, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-slate-700/50 rounded flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{win.type === 'win' ? '✅' : '❌'}</span>
                                        <span className="font-bold text-yellow-400 mr-2">#{win.round}</span>
                                        <span className="font-bold text-white">{win.name}</span>
                                        {win.type === 'fail' && (
                                            <span className="text-xs text-red-400 ml-2">(Kinh sai)</span>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400">{new Date(win.timestamp).toLocaleTimeString()}</span>
                                </div>
                            )) : (
                                <div className="text-center text-slate-500 py-4">No winners yet</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Players */}
                <aside className="w-80 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
                    <h3 className="text-lg font-bold mb-4 text-slate-300">Players ({players.length})</h3>
                    <div className="space-y-2">
                        {players.map(p => (
                            <div key={p.id} className="p-3 bg-slate-700/50 rounded-lg flex justify-between items-center">
                                <div>
                                    <div className="font-bold">{p.name}</div>
                                    <div className="text-xs text-slate-400">{p.setId ? `Set #${p.setId}` : 'Selecting...'}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {p.isReady && (
                                        <span className="text-xs font-bold text-green-400 bg-green-900/50 px-2 py-0.5 rounded">READY</span>
                                    )}
                                    <div className={clsx("w-2 h-2 rounded-full", p.setId ? "bg-green-400" : "bg-yellow-400")}></div>
                                    <button
                                        onClick={() => removePlayer(p.id)}
                                        className="text-slate-400 hover:text-red-400 ml-2 p-1 transition-colors"
                                        title="Remove Player"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default HostRoom;
