import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useHostGame } from '../hooks/useHostGame';
import { useSpeech } from '../hooks/useSpeech';
import IntroModal from '../components/IntroModal';
import AlertModal from '../components/AlertModal';
import { PrimaryButton, SecondaryButton, IconButton } from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const HostRoom: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();

    // Use our new Supabase Hook
    const {
        gameState,
        players,
        numbersDrawn,
        currentNumber,
        winHistory,
        verificationPopup,
        // availableSets, // Unused
        drawIntervalSeconds,
        actions
    } = useHostGame(roomId);

    // Use Speech Hook
    const {
        voiceLang,
        setVoiceLang,
        selectedVoiceURI,
        setSelectedVoiceURI,
        isMuted,
        setIsMuted,
        voices
    } = useSpeech(gameState, currentNumber);

    const [showToast, setShowToast] = useState(false);
    const [showAllTickets, setShowAllTickets] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);
    const [showIntro, setShowIntro] = useState(false);

    // Navigation safety
    useEffect(() => {
        if (!roomId) {
            navigate('/');
        }
    }, [roomId, navigate]);

    const copyRoomId = () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
        }
    };

    const exportHallOfFame = () => {
        const data = winHistory.map(record => ({
            Round: record.round,
            Player: record.name,
            Type: record.reason === 'BINGO' ? 'BINGO' : 'KINH SAI',
            Time: new Date(record.timestamp).toLocaleTimeString(),
            Participants: record.players ? record.players.map(p => `${p.name} (Set ${p.setId})`).join('; ') : 'N/A'
        }));

        const csv = [
            ['Round', 'Player', 'Type', 'Time', 'Participants'],
            ...data.map(row => [row.Round, row.Player, row.Type, row.Time, row.Participants])
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hall-of-fame-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const closeVerificationPopup = () => {
        const wasKinhSai = verificationPopup && !verificationPopup.success;
        actions.setVerificationPopup(null);
        if (wasKinhSai) {
            actions.resumeGame();
        }
    };

    // Helper to shorten voice name
    const formatVoiceName = (voice: SpeechSynthesisVoice | undefined) => {
        if (!voice) return 'Default';
        return voice.name
            .replace(/^Microsoft |^Google |^Apple /g, '')
            .replace(/ Online \(Natural\)| Mobile/g, '')
            .replace(/\s?-\s?.*$/, '')
            .trim();
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-900 text-white">
            {/* Toast Notification */}
            {showToast && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg font-bold animate-fade-in">
                    ✓ Copied ID!
                </div>
            )}

            {showAllTickets && (
                <Modal
                    isOpen={showAllTickets}
                    onClose={() => setShowAllTickets(false)}
                    title="👁️ All Player Tickets"
                    className="max-w-6xl h-[90vh]"
                >
                    <div className="flex-1 overflow-y-auto space-y-6 h-full p-1">
                        {players.map((player) => {
                            if (!player.tickets) return null;

                            // Helper to check if a row has bingo
                            const checkBingoRow = (row: number[]) => {
                                const nums = row.filter(n => n !== 0);
                                return nums.length > 0 && nums.every(n => numbersDrawn.includes(n));
                            };

                            return (
                                <div key={player.id} className="border-2 border-slate-700 bg-slate-900/50 p-4 rounded-lg">
                                    <div className="font-bold mb-2">{player.name} (Set #{player.setId})</div>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                        {player.tickets.map((ticket, tIdx) => (
                                            <div key={tIdx} className="border border-slate-700 bg-slate-800/50 p-2 rounded">
                                                {ticket.map((row, rIdx) => {
                                                    const isBingoRow = checkBingoRow(row);
                                                    return (
                                                        <div key={rIdx} className={clsx(
                                                            "grid grid-cols-9 gap-0.5 p-1 rounded",
                                                            isBingoRow ? "bg-green-900/50 border border-green-500 box-content" : ""
                                                        )}>
                                                            {row.map((num, cIdx) => (
                                                                <div key={cIdx} className={clsx(
                                                                    "flex items-center justify-center font-bold text-xs rounded h-7",
                                                                    num === 0 ? "invisible" : "",
                                                                    numbersDrawn.includes(num) ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-300"
                                                                )}>
                                                                    {num !== 0 ? num : ''}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Modal>
            )}

            {showHistory && (
                <Modal
                    isOpen={showHistory}
                    onClose={() => setShowHistory(false)}
                    title="🏆 Game History"
                    className="max-w-4xl h-[90vh]"
                >
                    <div className="flex justify-end mb-2">
                        <PrimaryButton
                            onClick={exportHallOfFame}
                            className="bg-green-600 hover:bg-green-700 text-sm py-1"
                        >
                            📥 Export CSV
                        </PrimaryButton>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-4 h-full">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-700">
                                    <th className="p-3">Round</th>
                                    <th className="p-3">Player</th>
                                    <th className="p-3">Type</th>
                                    <th className="p-3">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {winHistory.slice().reverse().map((record, idx) => (
                                    <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                        <td className="p-3 font-bold text-slate-300">#{record.round}</td>
                                        <td className="p-3 font-bold text-white">{record.name}</td>
                                        <td className="p-3">
                                            <span className={clsx(
                                                "px-2 py-1 rounded text-xs font-bold",
                                                record.reason === 'BINGO' ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"
                                            )}>
                                                {record.reason}
                                            </span>
                                        </td>
                                        <td className="p-3 text-sm text-slate-400">
                                            {typeof record.timestamp === 'string' ? new Date(record.timestamp).toLocaleTimeString() : record.timestamp instanceof Date ? record.timestamp.toLocaleTimeString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                                {winHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-500">No history yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Modal>
            )}

            {/* Header / Dashboard */}
            <header className="p-4 bg-slate-800 shadow-lg border-b border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex flex-col">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center gap-2">
                            LOTO ONLINE 🎲
                        </h1>
                        <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                            Room: <span className="text-white font-bold bg-slate-700 px-1 rounded">{roomId}</span>
                            <button onClick={copyRoomId} className="hover:text-cyan-400" title="Copy Room ID">📋</button>
                        </div>
                    </div>

                    {/* Mobile Actions Right */}
                    <div className="flex items-center gap-2 md:hidden">
                        <IconButton
                            onClick={() => setIsMuted(prev => !prev)}
                            title={isMuted ? "Unmute" : "Mute Sound"}
                            className={isMuted ? "bg-red-500/20 text-red-400 border-red-500/50" : "text-cyan-400 border-cyan-500/50"}
                        >
                            {isMuted ? "🔇" : "🔊"}
                        </IconButton>

                        <IconButton
                            onClick={() => setShowIntro(true)}
                            title="Hướng dẫn & Giới thiệu"
                            className="text-orange-400 border-orange-500/50"
                        >
                            i
                        </IconButton>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end">
                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center gap-2 mr-2">
                        <IconButton
                            onClick={() => setIsMuted(prev => !prev)}
                            title={isMuted ? "Unmute" : "Mute Sound"}
                            className={isMuted ? "bg-red-500/20 text-red-400 border-red-500/50" : "text-cyan-400 border-cyan-500/50"}
                        >
                            {isMuted ? "🔇" : "🔊"}
                        </IconButton>
                    </div>

                    <div className="bg-slate-900/50 p-1.5 rounded-lg border border-slate-700 flex items-center gap-2">
                        <select
                            value={drawIntervalSeconds}
                            onChange={(e) => actions.setDrawInterval(Number(e.target.value))}
                            className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer hover:text-cyan-400 transition-colors"
                            title="Tốc độ quay (giây)"
                        >
                            <option value="3">🚀 3s</option>
                            <option value="5">⚡ 5s</option>
                            <option value="8">🐢 8s</option>
                            <option value="10">🐌 10s</option>
                        </select>
                        <div className="h-4 w-px bg-slate-600"></div>
                        <button
                            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                            className="flex items-center gap-1 text-sm font-bold hover:text-cyan-400 transition-colors"
                            title="Cài đặt giọng đọc"
                        >
                            🗣️ {formatVoiceName(voices.find(v => v.voiceURI === selectedVoiceURI))}
                        </button>
                    </div>

                    {/* Desktop Intro Button */}
                    <IconButton
                        onClick={() => setShowIntro(true)}
                        title="Hướng dẫn & Giới thiệu"
                        className="hidden md:flex text-orange-400 border-orange-500/50"
                    >
                        i
                    </IconButton>
                </div>
            </header>

            {/* Voice Settings Dropdown */}
            {showVoiceSettings && (
                <div className="bg-slate-800 border-b border-slate-700 p-2 animate-slide-down flex flex-wrap justify-center gap-4 sticky top-[73px] z-30 shadow-lg">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-400">Ngôn ngữ:</label>
                        <select
                            value={voiceLang}
                            onChange={(e) => {
                                setVoiceLang(e.target.value);
                                setSelectedVoiceURI(''); // Reset specific voice when lang changes
                            }}
                            className="bg-slate-700 text-white text-xs p-1 rounded border border-slate-600"
                        >
                            <option value="vi">🇻🇳 VN</option>
                            <option value="en">🇺🇸 EN</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-400">Giọng đọc:</label>
                        <select
                            value={selectedVoiceURI}
                            onChange={(e) => setSelectedVoiceURI(e.target.value)}
                            className="bg-slate-700 text-white text-xs p-1 rounded border border-slate-600 max-w-[200px]"
                        >
                            <option value="">-- Tự động --</option>
                            {voices
                                .filter(v => v.lang.startsWith(voiceLang === 'vi' ? 'vi' : 'en'))
                                .map(v => (
                                    <option key={v.voiceURI} value={v.voiceURI}>
                                        {v.name}
                                    </option>
                                ))
                            }
                        </select>
                    </div>
                </div>
            )}

            {/* Main Game Area */}
            <main className="flex-1 overflow-hidden relative flex flex-col items-center justify-center p-4">
                {/* Background Decoration */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-900 -z-10"></div>

                {/* Current Number Display */}
                <div className="mb-8 md:mb-12 relative group">
                    {/* Glow effect */}
                    <div className={clsx(
                        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-96 md:h-96 rounded-full blur-3xl opacity-30 transition-all duration-500",
                        gameState === 'PLAYING' ? "bg-cyan-500 opacity-50 animate-pulse" : "bg-blue-600"
                    )}></div>

                    {/* Number Circle */}
                    <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full bg-slate-800 border-8 border-slate-700 flex items-center justify-center shadow-2xl z-10 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-700/50 to-transparent rounded-full"></div>

                        {/* The Number */}
                        <div key={currentNumber} className="text-8xl md:text-9xl font-black bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-300 drop-shadow-sm animate-pop-in">
                            {currentNumber || '--'}
                        </div>

                        {/* Status Label */}
                        <div className="absolute bottom-6 md:bottom-10 px-3 py-1 bg-slate-900/80 rounded-full text-xs md:text-sm font-bold text-cyan-400 uppercase tracking-widest border border-cyan-500/30 backdrop-blur-sm">
                            {gameState === 'PLAYING' ? 'Đang quay...' : gameState === 'PAUSED' ? 'Tạm dừng' : 'Sẵn sàng'}
                        </div>
                    </div>
                </div>

                {/* Control Buttons (Refactored) */}
                <div className="flex flex-col items-center gap-4 w-full max-w-sm z-20">
                    {gameState === 'WAITING' && (
                        <PrimaryButton onClick={actions.startGame}>
                            BẮT ĐẦU GAME 🚀
                        </PrimaryButton>
                    )}

                    {gameState === 'PLAYING' && (
                        <PrimaryButton
                            onClick={actions.pauseGame}
                            className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 shadow-orange-500/50"
                        >
                            ⏸ TẠM DỪNG
                        </PrimaryButton>
                    )}

                    {gameState === 'PAUSED' && (
                        <div className="flex gap-4 w-full">
                            <PrimaryButton onClick={actions.resumeGame} className="flex-1 text-lg">
                                ▶ TIẾP TỤC
                            </PrimaryButton>
                            <SecondaryButton onClick={actions.endGame} className="bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800">
                                ⏹ KẾT THÚC
                            </SecondaryButton>
                        </div>
                    )}

                    {gameState === 'ENDED' && (
                        <PrimaryButton onClick={actions.startGame}>
                            CHƠI VÁN MỚI 🔄
                        </PrimaryButton>
                    )}
                </div>

                {/* Stats / Info */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 md:gap-8 px-4 text-xs md:text-sm font-bold text-slate-400 z-10">
                    <div className="bg-slate-800/80 backdrop-blur px-4 py-2 rounded-full border border-slate-700 shadow-lg flex items-center gap-2 cursor-pointer hover:border-cyan-500 transition-colors" onClick={() => setShowHistory(true)}>
                        <span>🏆</span> Round: <span className="text-white">{winHistory.length + 1}</span>
                    </div>
                    <div className="bg-slate-800/80 backdrop-blur px-4 py-2 rounded-full border border-slate-700 shadow-lg flex items-center gap-2 cursor-pointer hover:border-cyan-500 transition-colors" onClick={() => setShowAllTickets(true)}>
                        <span>👥</span> Players: <span className="text-white">{players.length}</span>
                    </div>
                    <div className="bg-slate-800/80 backdrop-blur px-4 py-2 rounded-full border border-slate-700 shadow-lg flex items-center gap-2">
                        <span>🔢</span> Drawn: <span className="text-white">{numbersDrawn.length}</span>
                    </div>
                </div>
            </main>

            {/* Board Sidebar - Only for large screens or toggleable? */}
            <div className="hidden lg:flex absolute right-4 top-24 bottom-24 w-80 flex-col bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl overflow-hidden pointer-events-none opacity-50 hover:opacity-100 transition-opacity">
                {/* Mini Board View for Host */}
                <div className="p-2 overflow-y-auto grid grid-cols-5 gap-1">
                    {Array.from({ length: 90 }, (_, i) => i + 1).map(num => (
                        <div key={num} className={clsx("aspect-square flex items-center justify-center text-xs font-bold rounded", numbersDrawn.includes(num) ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-500")}>
                            {num}
                        </div>
                    ))}
                </div>
            </div>


            {/* Modals */}
            {verificationPopup && (
                <AlertModal
                    isOpen={!!verificationPopup}
                    onClose={closeVerificationPopup}
                    winnerName={verificationPopup?.playerName}
                    type={verificationPopup?.success ? 'bingo' : 'error'}
                    message={verificationPopup?.message}
                    markedNumbers={verificationPopup.markedNumbers}
                    drawnNumbers={verificationPopup.drawnNumbers}
                />
            )}

            {showIntro && (
                <IntroModal onClose={() => setShowIntro(false)} />
            )}
        </div>
    );
};

export default HostRoom;
