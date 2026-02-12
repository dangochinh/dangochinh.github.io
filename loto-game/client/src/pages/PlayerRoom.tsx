import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayerGame } from '../hooks/usePlayerGame';
import AlertModal from '../components/AlertModal';
import Ticket from '../components/Ticket';
import Modal from '../components/ui/Modal';
import { PrimaryButton } from '../components/ui/Button';
import { clsx } from 'clsx';
import { TicketGrid } from '../utils/gameLogic';
// import type { TicketSetInfo } from '../hooks/usePlayerGame'; // Unused

const PlayerRoom: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [playerName, setPlayerName] = useState<string>('');
    const [showJoinModal, setShowJoinModal] = useState<boolean>(true);

    const [activeRoomId, setActiveRoomId] = useState<string | undefined>(undefined);
    const [activePlayerName, setActivePlayerName] = useState<string | undefined>(undefined);

    const {
        gameState,
        availableSets,
        // players, // Unused for now
        isReady,
        numbersDrawn,
        // currentNumber, // Unused
        winHistory,
        mySetId,
        myTickets,
        // error, // Unused
        lastEvent,
        actions
    } = usePlayerGame(activeRoomId, activePlayerName);

    const [showHistory, setShowHistory] = useState(false);
    const [showDrawnNumbers, setShowDrawnNumbers] = useState(false);
    const [localMarkedNumbers, setLocalMarkedNumbers] = useState<number[]>([]);

    useEffect(() => {
        if (roomId) {
            // Check session storage for existing name to auto-rejoin?
            const savedName = sessionStorage.getItem('bingo_player_name');
            if (savedName) {
                setPlayerName(savedName);
            }
        } else {
            navigate('/');
        }
    }, [roomId, navigate]);

    const handleJoin = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!playerName.trim()) return;
        sessionStorage.setItem('bingo_player_name', playerName);
        setActiveRoomId(roomId);
        setActivePlayerName(playerName);
        setShowJoinModal(false);
    };

    // Sync marked numbers if needed, or just keep local.
    // For now, local marking is fine.

    const handleNumberClick = (num: number) => {
        if (num === 0) return;
        setLocalMarkedNumbers(prev => {
            if (prev.includes(num)) return prev.filter(n => n !== num);
            return [...prev, num];
        });
    };

    // Auto-mark drawn numbers? The hook handles drawn numbers update.
    // Let's verify KINH
    const handleKinh = () => {
        // Send ALL marked numbers, server validates
        const markedThatAreDrawn = localMarkedNumbers.filter(n => numbersDrawn.includes(n));
        actions.claimBingo(markedThatAreDrawn); // Only send valid ones? Or all? 
        // Logic in useHostGame checks against drawn numbers anyway.
        // But better to send what the user *thinks* they have.
        actions.claimBingo(localMarkedNumbers);
    };

    // Derived states
    // Group Available Sets by color or just list?
    // We need to implement set selection UI if mySetId is null.

    return (
        <div className="flex flex-col h-screen bg-slate-100 text-slate-800 overflow-hidden font-sans">
            {/* Header */}
            <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-lg">
                        LOTO
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800 text-sm leading-tight">Phòng {roomId}</h1>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <span className={clsx("w-2 h-2 rounded-full", gameState === 'PLAYING' ? "bg-green-500 animate-pulse" : "bg-slate-300")}></span>
                            {gameState === 'WAITING' ? 'Đang chờ...' : gameState === 'PLAYING' ? 'Đang quay' : gameState === 'PAUSED' ? 'Tạm dừng' : 'Kết thúc'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowDrawnNumbers(true)}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors relative"
                    >
                        🔢
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                            {numbersDrawn.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setShowHistory(true)}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        🏆
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full pb-20">

                {/* Join Modal */}
                {showJoinModal && (
                    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 md:scale-105">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-black text-slate-800 mb-2">Tham Gia Game</h2>
                                <p className="text-sm text-slate-500">Nhập tên để mọi người nhận ra bạn nhé!</p>
                            </div>
                            <form onSubmit={handleJoin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên hiển thị</label>
                                    <input
                                        type="text"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 focus:border-cyan-500 focus:bg-white text-lg font-bold outline-none transition-all"
                                        placeholder="Ví dụ: Mèo Ú 🐱"
                                        autoFocus
                                    />
                                </div>
                                <PrimaryButton type="submit" disabled={!playerName.trim()} className="w-full">
                                    VÀO PHÒNG NGAY
                                </PrimaryButton>
                            </form>
                        </div>
                    </div>
                )}

                {!showJoinModal && !mySetId && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg text-center">
                            <h2 className="text-2xl font-black mb-2">Chọn Vé Của Bạn 🎟️</h2>
                            <p className="text-indigo-100 text-sm">Hãy chọn một bộ vé may mắn để bắt đầu!</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {availableSets.filter(s => !s.isTaken).map((set) => (
                                <button
                                    key={set.id}
                                    onClick={() => actions.selectTicketSet(set.id)}
                                    className="relative group bg-white p-3 rounded-xl border-2 border-slate-200 hover:border-cyan-400 hover:shadow-lg transition-all text-left"
                                >
                                    <div className={`absolute top-2 right-2 w-3 h-3 rounded-full bg-${set.color}-500 shadow-sm`}></div>
                                    <div className="font-bold text-slate-700">Bộ #{set.id}</div>
                                    <div className="text-xs text-slate-400 mt-1">{set.name}</div>
                                    {/* Mini preview of ticket? Too complex for button */}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {myTickets && (
                    <div className="space-y-6 pb-24">
                        {/* Status Bar */}
                        {!isReady && gameState === 'WAITING' && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex gap-3 items-center">
                                    <span className="text-2xl animate-bounce">👋</span>
                                    <div className="text-sm">
                                        <p className="font-bold text-orange-800">Bạn đã chọn Bộ #{mySetId}</p>
                                        <p className="text-orange-600">Bấm "Sẵn Sàng" để Host bắt đầu nhé!</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tickets */}
                        <div className="grid grid-cols-1 gap-4">
                            {myTickets.map((ticketData: TicketGrid, idx: number) => (
                                <div key={idx} className="relative">
                                    <span className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-slate-400 z-10 uppercase tracking-wider">
                                        Vé {idx + 1}
                                    </span>
                                    <Ticket
                                        data={ticketData}
                                        markedNumbers={localMarkedNumbers}
                                        onNumberClick={handleNumberClick}
                                        // Pass set info color if available, default blue
                                        color={'blue'}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Bottom Action Bar */}
            {myTickets && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg z-20 md:max-w-3xl md:mx-auto safe-area-bottom">
                    <div className="flex gap-3">
                        {gameState === 'WAITING' ? (
                            <PrimaryButton
                                onClick={actions.toggleReady}
                                className={clsx(
                                    "flex-1 text-lg py-3 shadow-lg", // Ensure text-lg is applied
                                    isReady
                                        ? "bg-gradient-to-r from-slate-400 to-slate-500 hover:from-slate-400 hover:to-slate-500 shadow-slate-500/50 grayscale opacity-80"
                                        : "bg-gradient-to-r from-green-500 to-emerald-600 shadow-green-500/50"
                                )}
                            >
                                {isReady ? 'ĐÃ SẴN SÀNG ✅' : 'SẴN SÀNG! 🚀'}
                            </PrimaryButton>
                        ) : (
                            <PrimaryButton
                                onClick={handleKinh}
                                className="flex-1 bg-gradient-to-r from-red-500 via-rose-500 to-pink-600 shadow-red-500/50 animate-pulse text-2xl font-black tracking-widest py-3"
                            >
                                KINH! 🔥
                            </PrimaryButton>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showDrawnNumbers && (
                <Modal
                    isOpen={showDrawnNumbers}
                    onClose={() => setShowDrawnNumbers(false)}
                    title="Các số đã gọi"
                    className="max-h-[80vh]"
                >
                    <div className="grid grid-cols-6 md:grid-cols-9 gap-1.5 p-1">
                        {Array.from({ length: 90 }, (_, i) => i + 1).map(num => (
                            <div
                                key={num}
                                className={clsx(
                                    "aspect-square flex items-center justify-center rounded-lg text-sm font-bold transition-all",
                                    numbersDrawn.includes(num)
                                        ? "bg-cyan-500 text-white shadow-md scale-100"
                                        : "bg-slate-100 text-slate-300 scale-90"
                                )}
                            >
                                {num}
                            </div>
                        ))}
                    </div>
                </Modal>
            )}

            {showHistory && (
                <Modal
                    isOpen={showHistory}
                    onClose={() => setShowHistory(false)}
                    title="Lịch sử thắng"
                >
                    <div className="space-y-3">
                        {winHistory.slice().reverse().map((record, idx) => (
                            <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-slate-800">{record.name}</div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(record.timestamp).toLocaleTimeString()} - Vòng {record.round}
                                    </div>
                                </div>
                                <div className={clsx(
                                    "px-2 py-1 rounded text-xs font-bold uppercase",
                                    record.reason === 'BINGO' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                )}>
                                    {record.reason}
                                </div>
                            </div>
                        ))}
                        {winHistory.length === 0 && (
                            <p className="text-center text-slate-400 py-4">Chưa có ai thắng cả.</p>
                        )}
                    </div>
                </Modal>
            )}

            {/* Alert/Verification Modal */}
            {lastEvent && lastEvent.type === 'verification' && (
                <AlertModal
                    isOpen={!!lastEvent}
                    onClose={() => actions.closeVerificationPopup()} // Or clear lastEvent locally?
                    // Verify logic for checking who is winner/loser of verification?
                    // Usually usePlayerGame handles verificationPopup state
                    message={lastEvent.message}
                    type={lastEvent.success ? 'bingo' : 'kinh_sai'}
                />
            )}
        </div>
    );
};

export default PlayerRoom;
