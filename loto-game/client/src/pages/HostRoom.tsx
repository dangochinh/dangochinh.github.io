import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useHostGame } from '../hooks/useHostGame';
import IntroModal from '../components/IntroModal';

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
        drawIntervalSeconds,
        actions
    } = useHostGame(roomId);

    const [showToast, setShowToast] = useState(false);
    const [showAllTickets, setShowAllTickets] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [voiceLang, setVoiceLang] = useState<'vi' | 'en'>('vi');
    const [selectedVoiceURI, setSelectedVoiceURI] = useState(''); // Allow specific voice selection

    const [showVoiceSettings, setShowVoiceSettings] = useState(false);
    const [showIntro, setShowIntro] = useState(false);
    const [showExitConfirmation, setShowExitConfirmation] = useState(false);
    const [showPlayerListMobile, setShowPlayerListMobile] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    // Navigation safety
    useEffect(() => {
        if (!roomId) {
            navigate('/');
        }
    }, [roomId, navigate]);

    // Preload voices on mount
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    useEffect(() => {
        const loadVoices = () => {
            let availableVoices = window.speechSynthesis.getVoices();
            if (availableVoices.length > 0) {
                // Initial filter to relevant voices if possible, or just keep all
                setVoices(availableVoices);

                // Try to auto-select a good Vietnamese voice if not yet selected
                if (!selectedVoiceURI) {
                    const viVoice = availableVoices.find(v => v.lang.includes('vi') || v.lang.includes('VN'));
                    if (viVoice) setSelectedVoiceURI(viVoice.voiceURI);
                }
            }
        };

        // Load voices immediately and also on change event
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, [selectedVoiceURI]); // Add selectedVoiceURI dependency to ensure we don't overwrite if set? No, logical check inside is fine.

    // Speech synthesis effect
    useEffect(() => {
        if (currentNumber && gameState === 'PLAYING') {
            speakNumber(currentNumber);
        }
    }, [currentNumber, voiceLang, voices]); // Removed voiceLang/voices dependency? No, keep them.

    // Cancel speech when game ends
    useEffect(() => {
        if (gameState === 'ENDED' || gameState === 'WAITING') {
            window.speechSynthesis.cancel();
        }
    }, [gameState]);

    const speakNumber = (num: number) => {
        if (!isMuted && 'speechSynthesis' in window && voices.length > 0) {
            // Cancel any ongoing speech first
            window.speechSynthesis.cancel();

            const text = voiceLang === 'vi' ? `Số ${num}` : `Number ${num}`;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = voiceLang === 'vi' ? 'vi-VN' : 'en-US';

            let selectedVoice;

            // 1. Try manually selected voice first
            if (selectedVoiceURI) {
                selectedVoice = voices.find(v => v.voiceURI === selectedVoiceURI);
            }

            // 2. Auto-select based on language if manual selection not valid for current lang or not set
            if (!selectedVoice || !selectedVoice.lang.includes(voiceLang === 'vi' ? 'vi' : 'en')) {
                if (voiceLang === 'vi') {
                    selectedVoice = voices.find(voice => voice.lang.includes('vi') || voice.lang.includes('VN'));
                    // Fallback to Google Vietnamese or similar if "vi" check failed but name has it (some browsers weirdness)
                    if (!selectedVoice) selectedVoice = voices.find(v => v.name.includes('Vietnamese') || v.name.includes('Tiếng Việt'));
                } else {
                    selectedVoice = voices.find(voice => voice.lang.includes('en-US') && !voice.name.includes('Zira'));
                }
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
                // console.log(`Speaking "${text}" with voice: ${selectedVoice.name}`);
            } else {
                console.warn(`No specific voice found for ${voiceLang}. Using system default.`);
            }

            window.speechSynthesis.speak(utterance);
        }
    };

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
            BingoTrung: record.coWinners?.join(' & ') || '-',
            Type: record.reason === 'BINGO' ? 'BINGO' : 'KINH SAI',
            Time: new Date(record.timestamp).toLocaleTimeString(),
            Participants: record.players ? record.players.map(p => `${p.name} (Set ${p.setId})`).join('; ') : 'N/A'
        }));

        const csv = [
            ['Round', 'Player', 'Bingo Trùng', 'Type', 'Time', 'Participants'],
            ...data.map(row => [row.Round, row.Player, row.BingoTrung, row.Type, row.Time, row.Participants])
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
        // Remove common prefixes/suffixes for cleaner UI
        return voice.name
            .replace(/^Microsoft |^Google |^Apple /g, '')
            .replace(/ Online \(Natural\)| Mobile/g, '')
            .replace(/\s?-\s?.*$/, '') // Remove " - Vietnamese (Vietnam)" etc
            .trim();
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-900 text-white">
            {/* Toast Notification */}
            {showToast && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg font-bold animate-fade-in">
                    ✓ Đã sao chép ID!
                </div>
            )}

            {/* BINGO_WINDOW Host Overlay */}
            {gameState === 'BINGO_WINDOW' && (
                <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black z-50 flex items-center justify-between px-4 py-3 shadow-lg">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🏆</span>
                        <div>
                            <div className="font-bold text-sm">Cửa sổ Bingo Trùng đang mở (5 giây)...</div>
                            <div className="text-xs">{/* We don't have coWinners count here, but it will update on endBingoWindow */}
                                Người chơi khác có thể bấm KINH nếu có Bingo!
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={actions.endBingoWindow}
                        className="px-4 py-2 bg-black/20 hover:bg-black/40 rounded-lg font-bold text-sm transition-colors"
                    >
                        Kết Thúc Ngay
                    </button>
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



                        <div className="flex-1 overflow-y-auto space-y-4">
                            {verificationPopup.playerTickets && verificationPopup.playerTickets.map((ticket, idx) => (
                                <div key={idx} className="border-2 border-slate-700 bg-slate-900/50 p-3 rounded-lg">
                                    <div className="text-sm text-slate-400 mb-2">Vé {idx + 1}</div>
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

                        <div className="mt-4">
                            <button
                                onClick={closeVerificationPopup}
                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 rounded-lg font-bold text-lg"
                            >
                                {verificationPopup.success ? 'Đóng' : 'Đóng & Tiếp Tục'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAllTickets && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-6xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-cyan-400">👁️ Tất Cả Vé Người Chơi</h3>
                            <button onClick={() => setShowAllTickets(false)} className="text-slate-400 hover:text-white text-2xl">✕</button>
                        </div>
                        {/* Tickets rendering logic similar to before, using players state */}
                        <div className="flex-1 overflow-y-auto space-y-6">
                            {players.map((player) => {
                                if (!player.tickets) return null;

                                // Helper to check if a row has bingo
                                const checkBingoRow = (row: number[]) => {
                                    const nums = row.filter(n => n !== 0);
                                    return nums.every(n => numbersDrawn.includes(n));
                                };

                                // Helper: check if row has 4/5 drawn (almost bingo)
                                const getAlmostBingoNum = (row: number[]): number | null => {
                                    const nums = row.filter(n => n !== 0);
                                    if (nums.length < 5) return null;
                                    const undrawn = nums.filter(n => !numbersDrawn.includes(n));
                                    return undrawn.length === 1 ? undrawn[0] : null;
                                };

                                return (
                                    <div key={player.id} className="border-2 border-slate-700 bg-slate-900/50 p-4 rounded-lg">
                                        <div className="font-bold mb-2">{player.name} (Set #{player.setId})</div>
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                            {player.tickets.map((ticket, tIdx) => (
                                                <div key={tIdx} className="border border-slate-700 bg-slate-800/50 p-2 rounded">
                                                    {ticket.map((row, rIdx) => {
                                                        const isBingoRow = checkBingoRow(row);
                                                        const almostBingoNum = !isBingoRow ? getAlmostBingoNum(row) : null;
                                                        return (
                                                            <div key={rIdx} className={clsx(
                                                                "grid grid-cols-9 gap-0.5 p-1 rounded",
                                                                isBingoRow ? "bg-green-900/50 border border-green-500 box-content" :
                                                                    almostBingoNum ? "bg-yellow-900/20 border border-yellow-600/50 box-content" : ""
                                                            )}>
                                                                {row.map((num, cIdx) => (
                                                                    <div key={cIdx} className={clsx(
                                                                        "flex items-center justify-center font-bold text-xs rounded h-7",
                                                                        num === 0 ? "invisible" : "",
                                                                        num !== 0 && num === almostBingoNum
                                                                            ? "bg-yellow-500 text-black animate-pulse ring-2 ring-yellow-400"
                                                                            : numbersDrawn.includes(num) ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-300"
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
                    </div>
                </div>
            )}

            {showHistory && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-bold text-yellow-400">🏆 Lịch Sử Vòng Đấu</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={exportHallOfFame}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm flex items-center gap-2"
                                >
                                    📥 Xuất CSV
                                </button>
                                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white text-2xl">✕</button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-slate-900/50 rounded-lg p-4">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-700">
                                        <th className="p-3">Vòng</th>
                                        <th className="p-3">Người Chơi</th>
                                        <th className="p-3">Bingo Trùng</th>
                                        <th className="p-3">Loại</th>
                                        <th className="p-3">Thời Gian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {winHistory.slice().reverse().map((record, idx) => (
                                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                            <td className="p-3 font-bold text-slate-300">#{record.round}</td>
                                            <td className="p-3 font-bold text-white">{record.name}</td>
                                            <td className="p-3 text-yellow-400 text-sm">
                                                {record.coWinners && record.coWinners.length > 0
                                                    ? record.coWinners.join(', ')
                                                    : <span className="text-slate-600">-</span>}
                                            </td>
                                            <td className="p-3">
                                                <span className={clsx(
                                                    "px-2 py-1 rounded text-xs font-bold",
                                                    record.reason === 'BINGO' ? "bg-green-900 text-green-400" : "bg-red-900 text-red-400"
                                                )}>
                                                    {record.reason}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm text-slate-400">
                                                {new Date(record.timestamp).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {winHistory.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-500">Chưa có lịch sử.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-slate-800 shadow-md z-10">
                {/* Row 1: Room Info + Voice + Speed */}
                <div className="flex items-center justify-between px-2 md:px-4 py-1.5 md:py-2 border-b border-slate-700/50">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">Phòng</span>
                            <span onClick={copyRoomId} className="cursor-pointer font-mono font-bold text-white text-lg hover:text-cyan-400 transition-colors underline decoration-dashed underline-offset-4" title="Click to copy">{roomId}</span>
                        </div>
                        <span className={clsx("px-2 py-0.5 rounded-full text-xs font-bold",
                            gameState === 'WAITING' ? "bg-yellow-500/20 text-yellow-400" :
                                gameState === 'PLAYING' ? "bg-green-500/20 text-green-400" :
                                    gameState === 'PAUSED' ? "bg-orange-500/20 text-orange-400" :
                                        "bg-red-500/20 text-red-400"
                        )}>
                            {gameState}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {/* Mute */}
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className={clsx("p-1.5 rounded border border-slate-600 transition-colors text-sm", isMuted ? "bg-red-900/50 text-red-400 border-red-800" : "bg-slate-700/50 hover:bg-slate-600 text-slate-300")}
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? "🔇" : "🔊"}
                        </button>

                        {/* Voice Settings */}
                        <div className="relative">
                            <button
                                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                                className="px-2 py-1.5 rounded border border-slate-600 bg-slate-700/50 hover:bg-slate-600 text-xs font-bold transition-colors flex items-center gap-1"
                                title="Click to select specific voice"
                            >
                                {voiceLang === 'vi' ? '🇻🇳' : '🇺🇸'} <span className="hidden sm:inline">{formatVoiceName(voices.find(v => v.voiceURI === selectedVoiceURI))}</span>
                            </button>

                            {showVoiceSettings && (
                                <div className="absolute top-full lg:left-0 right-0 mt-2 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2 z-50">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700">
                                        <span className="text-xs font-bold text-slate-400">Cài Đặt</span>
                                        <button onClick={() => setShowVoiceSettings(false)} className="text-xs text-slate-500 hover:text-white">✕</button>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex gap-2 mb-2">
                                            <button onClick={() => { setVoiceLang('vi'); setShowVoiceSettings(false); }} className={clsx("flex-1 py-1 text-xs rounded border font-bold", voiceLang === 'vi' ? "bg-red-900/50 border-red-700 text-red-200" : "border-slate-600 hover:bg-slate-700")}>🇻🇳 VN</button>
                                            <button onClick={() => { setVoiceLang('en'); setShowVoiceSettings(false); }} className={clsx("flex-1 py-1 text-xs rounded border font-bold", voiceLang === 'en' ? "bg-blue-900/50 border-blue-700 text-blue-200" : "border-slate-600 hover:bg-slate-700")}>🇺🇸 EN</button>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-1">Chọn Giọng Đọc:</div>
                                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                                            <button onClick={() => { setSelectedVoiceURI(''); setShowVoiceSettings(false); }} className={clsx("text-left px-2 py-1.5 rounded text-xs transition-colors", selectedVoiceURI === '' ? "bg-cyan-900/50 text-cyan-300 border border-cyan-700/50" : "hover:bg-slate-700 text-slate-300")}>-- Tự Động Chọn --</button>
                                            {voices.filter(v => v.lang.includes(voiceLang === 'vi' ? 'vi' : 'en')).map(v => (
                                                <button key={v.voiceURI} onClick={() => { setSelectedVoiceURI(v.voiceURI); setShowVoiceSettings(false); }} className={clsx("text-left px-2 py-1.5 rounded text-xs transition-colors", selectedVoiceURI === v.voiceURI ? "bg-cyan-900/50 text-cyan-300 border border-cyan-700/50" : "hover:bg-slate-700 text-slate-300")}>{formatVoiceName(v)}</button>
                                            ))}
                                            {voices.filter(v => v.lang.includes(voiceLang === 'vi' ? 'vi' : 'en')).length === 0 && (
                                                <div className="text-xs text-slate-500 italic p-2">Không tìm thấy giọng đọc</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Draw Interval */}
                        <div className="flex items-center gap-1 bg-slate-700/50 rounded px-1.5 py-1 border border-slate-600">
                            <label className="text-xs text-slate-400 hidden md:inline">Tốc độ:</label>
                            <input
                                type="number" min="1" max="60"
                                value={drawIntervalSeconds}
                                onChange={(e) => actions.setDrawInterval(Number(e.target.value))}
                                className="w-10 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-sm text-white text-center"
                            />
                            <span className="text-xs text-slate-500">s</span>
                        </div>
                    </div>
                </div>

                {/* Row 2: Action Buttons */}
                <div className="flex items-center justify-between px-2 md:px-4 py-1.5 md:py-2 gap-1.5">
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => setShowPlayerListMobile(!showPlayerListMobile)}
                            className={clsx("md:hidden px-2.5 py-1.5 rounded-lg font-bold text-sm", showPlayerListMobile ? "bg-cyan-600 text-white" : "bg-slate-700 text-slate-300")}
                            title="Toggle Players"
                        >👥</button>
                        <button onClick={() => setShowAllTickets(true)} className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-sm" title="Xem Vé">
                            👁️ <span className="hidden md:inline">Xem Vé</span>
                        </button>
                        <button onClick={() => setShowHistory(true)} className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg font-bold text-sm" title="History">
                            📜 <span className="hidden md:inline">Lịch Sử</span>
                        </button>
                    </div>

                    <div className="flex gap-1.5">
                        {gameState === 'WAITING' && (
                            <button
                                onClick={() => actions.startGame()}
                                disabled={players.length === 0 || !players.every(p => p.isReady)}
                                className={clsx("px-3 md:px-5 py-1.5 rounded-lg font-bold text-sm transition-all",
                                    players.length > 0 && players.every(p => p.isReady)
                                        ? "bg-green-600 hover:bg-green-700 shadow-lg hover:scale-105"
                                        : "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                                )}
                            >
                                {players.length === 0 ? "Đợi..." : <><span className="md:hidden">▶️</span><span className="hidden md:inline">Bắt Đầu</span></>}
                            </button>
                        )}
                        {gameState === 'PLAYING' && (
                            <button onClick={actions.pauseGame} className="px-3 md:px-5 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-bold text-sm">
                                <span className="md:hidden">⏸️</span><span className="hidden md:inline">Tạm Dừng</span>
                            </button>
                        )}
                        {gameState === 'PAUSED' && (
                            <button onClick={actions.resumeGame} className="px-3 md:px-5 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm">
                                <span className="md:hidden">▶️</span><span className="hidden md:inline">Tiếp Tục</span>
                            </button>
                        )}
                        <button onClick={() => setShowExitConfirmation(true)} className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm" title="Exit">
                            <span className="md:hidden">🚪</span><span className="hidden md:inline">Thoát</span>
                        </button>
                        <button
                            onClick={() => setShowIntro(true)}
                            className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 hover:from-orange-300 hover:to-orange-500 flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 border border-orange-300/50"
                            title="Hướng dẫn & Ủng hộ"
                        >
                            <span className="text-lg font-bold font-serif italic">i</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden">
                {/* Board */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="flex justify-center mb-8">
                        {/* Current Number */}
                        {currentNumber && (
                            <div className="text-5xl font-bold bg-gradient-to-br from-pink-500 to-violet-600 w-24 h-24 rounded-full flex items-center justify-center shadow-lg">
                                {currentNumber}
                            </div>
                        )}
                        {gameState === 'ENDED' && (
                            <div className="ml-8 text-center">
                                <h2 className="text-3xl font-bold text-yellow-400">Kết Thúc Game</h2>
                                <button onClick={actions.restartGame} className="mt-2 px-6 py-2 bg-green-600 rounded font-bold">Ván Mới</button>
                            </div>
                        )}
                    </div>

                    {/* Board Grid - Column-major order (top-to-bottom, left-to-right) */}
                    <div className="grid grid-cols-10 gap-2 max-w-4xl mx-auto mt-8">
                        {Array.from({ length: 90 }, (_, i) => {
                            // Column-major: col = floor(i/9), row = i%9
                            // num = row * 10 + col + 1
                            const col = Math.floor(i / 9);
                            const row = i % 9;
                            const num = row * 10 + col + 1;
                            return (
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
                            );
                        })}
                    </div>
                </div>

                {/* Players List */}
                {/* Mobile Overlay */}
                {showPlayerListMobile && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 md:hidden"
                        onClick={() => setShowPlayerListMobile(false)}
                    />
                )}

                <aside className={clsx(
                    "w-80 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto transition-transform duration-300 ease-in-out z-40",
                    "fixed inset-y-0 right-0 md:static md:translate-x-0",
                    showPlayerListMobile ? "translate-x-0 shadow-2xl" : "translate-x-full"
                )}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-300">Người Chơi ({players.length})</h3>
                        <button
                            onClick={() => setShowPlayerListMobile(false)}
                            className="md:hidden text-slate-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-2">
                        {players.map(p => (
                            <div key={p.id} className="p-3 bg-slate-700/50 rounded-lg flex justify-between items-center">
                                <div>
                                    <div className="font-bold">{p.name}</div>
                                    <div className="text-xs text-slate-400">{p.setId !== -1 ? `Set #${p.setId}` : 'Đang chọn...'}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {p.isReady && <span className="text-xs bg-green-900 text-green-400 px-2 py-0.5 rounded">READY</span>}
                                    {actions.removePlayer && (
                                        <button onClick={() => actions.removePlayer!(p.id)} className="text-red-400 hover:text-red-300">✕</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </main>
            {/* Intro Modal */}
            {showIntro && <IntroModal onClose={() => setShowIntro(false)} />}

            {/* Exit Confirmation Modal */}
            {showExitConfirmation && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md flex flex-col border border-slate-600 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4 text-center">Bạn có chắc muốn thoát?</h3>
                        <p className="text-slate-400 text-center mb-6 text-sm">Trò chơi đang diễn ra. Nếu bạn thoát, quyền Host có thể bị mất.</p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    exportHallOfFame();
                                    navigate('/');
                                }}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-white flex items-center justify-center gap-2"
                            >
                                📥 Thoát & Tải Lịch Sử
                            </button>

                            <button
                                onClick={() => navigate('/')}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-white"
                            >
                                🚪 Thoát Luôn
                            </button>

                            <button
                                onClick={() => setShowExitConfirmation(false)}
                                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-slate-200"
                            >
                                ↩️ Ở Lại
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default HostRoom;
