import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Ticket from '../components/Ticket';
import WinnerModal from '../components/WinnerModal';
import AlertModal from '../components/AlertModal';
import { clsx } from 'clsx';
import { usePlayerGame } from '../hooks/usePlayerGame';
import { TicketGrid } from '../utils/gameLogic';

interface LocationState {
    name?: string;
}

const PlayerRoom: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as LocationState;
    const nameState = state?.name;

    // Persist name for refresh support if passed via state
    useEffect(() => {
        if (nameState) {
            sessionStorage.setItem('bingo_player_name', nameState);
        }
    }, [nameState]);

    const finalName = nameState || sessionStorage.getItem('bingo_player_name') || '';

    const {
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
        actions,
        error,
        isHostConnected,
        isConnecting,
        coWinners
    } = usePlayerGame(roomId, finalName);

    // Derived State for UI
    const [markedNumbers, setMarkedNumbers] = useState<number[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showDrawnNumbers, setShowDrawnNumbers] = useState(false);

    interface WinnerInfo {
        name: string;
        isMe: boolean;
        coWinners?: string[];
    }
    const [winnerInfo, setWinnerInfo] = useState<WinnerInfo | null>(null);

    interface AlertInfo {
        title?: string;
        message: string;
        type: 'error' | 'warning' | 'info' | 'bingo' | 'kinh_sai';
    }
    const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);
    const [previousSetId, setPreviousSetId] = useState<number | null>(null);

    // Ticket Color
    const [myTicketColor, setMyTicketColor] = useState<string | null>(null);
    useEffect(() => {
        if (mySetId && availableSets) {
            const set = availableSets.find(s => s.id === mySetId);
            if (set) setMyTicketColor(set.color);
        }
    }, [mySetId, availableSets]);

    // Handle Game Events (Toasts/Alerts)
    useEffect(() => {
        if (!lastEvent) return;

        if (lastEvent.type === 'gameEnded') {
            const { winner, reason, coWinners: eventCoWinners } = lastEvent.data;
            if (reason === 'BINGO') {
                setWinnerInfo({
                    name: winner.name,
                    isMe: winner.name === finalName || (eventCoWinners && eventCoWinners.includes(finalName)),
                    coWinners: eventCoWinners
                });
            }
        } else if (lastEvent.type === 'verification') {
            // Handle verification result if needed specifically, 
            // but usually usePlayerGame handles it via generic events or we should listen to specific fails.
            // The old code listened to 'kinhFailed'.
            // My hook exposes 'verification' event.
            if (!lastEvent.success) {
                setAlertInfo({
                    title: 'Kinh sai!!!',
                    message: `${lastEvent.message}`,
                    type: 'kinh_sai'
                });
            }
        }
    }, [lastEvent, finalName]);

    // Reset marked numbers on restart
    useEffect(() => {
        if (gameState === 'WAITING') {
            setMarkedNumbers([]);
            setWinnerInfo(null);
            setAlertInfo(null);
        }
    }, [gameState]);


    // Redirect if invalid name
    useEffect(() => {
        if (!roomId || !finalName) {
            navigate('/');
        }
    }, [roomId, finalName, navigate]);

    // Handle Host Disconnect
    const [disconnectCountdown, setDisconnectCountdown] = useState<number | null>(null);
    useEffect(() => {
        if (!isHostConnected && !error) { // Only count down if not already erroring
            setDisconnectCountdown(3);
        } else {
            setDisconnectCountdown(null);
        }
    }, [isHostConnected, error]);

    useEffect(() => {
        if (disconnectCountdown === null) return;

        if (disconnectCountdown <= 0) {
            // Instead of alert, just wait a bit then navigate
            const t = setTimeout(() => navigate('/'), 2000);
            return () => clearTimeout(t);
        }

        const timer = setTimeout(() => {
            setDisconnectCountdown(prev => prev !== null ? prev - 1 : null);
        }, 1000);

        return () => clearTimeout(timer);
    }, [disconnectCountdown, navigate]);

    const handleAlertClose = () => {
        setAlertInfo(null);
        if (error) {
            navigate('/');
        }
    };

    const handleNumberClick = (num: number) => {
        if (markedNumbers.includes(num)) {
            setMarkedNumbers(prev => prev.filter(n => n !== num));
        } else {
            setMarkedNumbers(prev => [...prev, num]);
        }
    };

    const autoMarkDrawnNumbers = () => {
        const numbersInTickets: number[] = [];
        if (myTickets) {
            myTickets.forEach((ticket: TicketGrid) => {
                ticket.forEach(row => {
                    row.forEach(num => {
                        if (num !== 0 && numbersDrawn.includes(num)) {
                            numbersInTickets.push(num);
                        }
                    });
                });
            });
        }
        setMarkedNumbers(numbersInTickets);
        setShowDrawnNumbers(false);
    };

    const handleKinh = () => {
        if (markedNumbers.length === 0) {
            setAlertInfo({ message: 'Bạn chưa đánh số nào cả!', type: 'warning' });
            return;
        }
        actions.claimBingo(markedNumbers);
    };

    if (!roomId) return null;

    if (isConnecting) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
                <div className="w-16 h-16 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h2 className="text-xl font-bold">Đang kết nối đến phòng...</h2>
                <div className="text-sm text-slate-400 mt-2">Đang tìm Chủ phòng (Timeout 5s)</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-red-500 mb-2">Không Thể Vào Phòng</h2>
                <p className="text-slate-300 mb-6">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold"
                >
                    Về Trang Chủ
                </button>
            </div>
        );
    }

    {/* Mid-game join: player has no tickets and game is not WAITING */ }
    if (gameState !== 'WAITING' && (!myTickets || myTickets.length === 0)) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="text-6xl mb-4">⏳</div>
                <h2 className="text-2xl font-bold text-yellow-400 mb-2">Ván Đang Diễn Ra</h2>
                <p className="text-slate-300 mb-3">Phòng <span className="font-mono font-bold text-white">{roomId}</span> đang chơi ván hiện tại.</p>
                <p className="text-slate-400 text-sm mb-6">Vui lòng chờ Host kết thúc ván và bắt đầu ván mới để tham gia.</p>
                <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-slate-500">Tự động tham gia khi ván mới bắt đầu...</p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-sm"
                >
                    Về Trang Chủ
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 pb-20">
            {/* Header - Mobile Optimized */}
            <div className="fixed top-0 left-0 right-0 bg-slate-800 shadow-lg z-30">
                {/* Main Header Row */}
                <div className="flex justify-between items-center px-3 py-2">
                    {/* Left: Room ID & History */}
                    <div className="flex flex-col items-start min-w-[70px]">
                        <div className="text-xs text-slate-400">Phòng</div>
                        <div className="font-bold text-sm">{roomId}</div>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className="text-xs px-2 py-0.5 mt-1 bg-slate-700 rounded border border-slate-600 hover:bg-slate-600"
                        >
                            🏆
                        </button>
                    </div>

                    {/* Center: Current Number + Recent Numbers */}
                    <div className="flex flex-col items-center">
                        {(gameState === 'PLAYING' || gameState === 'PAUSED') && currentNumber ? (
                            <>
                                {/* Recent Numbers */}
                                <div className="flex gap-1 mb-1">
                                    {Array.from({ length: 4 }).map((_, i) => {
                                        const idx = numbersDrawn.length - (5 - i);
                                        if (idx < 0) return <div key={i} className="w-6 h-6" />;
                                        return (
                                            <div key={i} className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                                                <span className="text-xs text-slate-400">{numbersDrawn[idx]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Current Number - Large */}
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-lg animate-pulse">
                                    <span className="text-3xl font-bold">{currentNumber}</span>
                                </div>
                            </>
                        ) : (
                            <div className={clsx(
                                "px-3 py-1 rounded-full text-sm font-bold",
                                gameState === 'WAITING' ? "bg-yellow-500/20 text-yellow-400" :
                                    gameState === 'ENDED' ? "bg-red-500/20 text-red-400" :
                                        "bg-slate-700 text-slate-400"
                            )}>
                                {gameState}
                            </div>
                        )}
                    </div>

                    {/* Right: Player Info & Ready Count */}
                    <div className="flex flex-col items-end min-w-[70px]">
                        <div className="text-xs text-slate-400 truncate max-w-[80px]">{finalName}</div>
                        {mySetId && <div className="text-xs font-bold text-cyan-400">Set #{mySetId}</div>}
                        {myTickets && (
                            <div className={clsx("text-xs font-bold mt-1 px-2 py-0.5 rounded",
                                isReady ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                            )}>
                                {isReady ? "SẴN SÀNG" : "CHƯA SẴN SÀNG"}
                            </div>
                        )}
                        {/* Player count */}
                        <div className="text-xs text-slate-500 mt-1">
                            {players.filter(p => p.isReady).length}/{players.length} sẵn sàng
                        </div>
                    </div>
                </div>
            </div>

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-yellow-400">🏆 Bảng Vàng</h3>
                            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {winHistory.length > 0 ? winHistory.slice().reverse().map((win, idx) => (
                                <div key={idx} className={clsx(
                                    "flex justify-between items-center p-3 rounded",
                                    win.type === 'win' ? "bg-green-900/30 border border-green-700/50" : "bg-red-900/30 border border-red-700/50"
                                )}>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-yellow-400">#{win.round}</span>
                                        <span className="font-bold text-white">{win.name}</span>
                                        <span className={clsx(
                                            "text-xs px-2 py-0.5 rounded font-bold",
                                            win.type === 'win'
                                                ? "bg-green-500/30 text-green-400"
                                                : "bg-red-500/30 text-red-400"
                                        )}>
                                            {win.type === 'win' ? '🎉 BINGO' : '❌ SAI'}
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-400">{new Date(win.timestamp).toLocaleTimeString()}</span>
                                </div>
                            )) : <div className="text-center text-slate-500">Chưa có người thắng.</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* Drawn Numbers Popup */}
            {showDrawnNumbers && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-yellow-400">📋 Số Đã Rút ({numbersDrawn.length})</h3>
                            <button onClick={() => setShowDrawnNumbers(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-10 gap-2">
                                {numbersDrawn.map((num, idx) => (
                                    <div key={idx} className="aspect-square flex items-center justify-center rounded bg-violet-600 text-white font-bold">
                                        {num}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4">
                            <button onClick={autoMarkDrawnNumbers} className="w-full px-6 py-3 bg-green-600 rounded-lg font-bold">✓ Tự Động Dò</button>
                        </div>
                    </div>
                </div>
            )}

            {/* BINGO_WINDOW Banner */}
            {gameState === 'BINGO_WINDOW' && lastEvent?.type === 'bingoConfirmed' && (
                <div className="fixed top-14 left-0 right-0 z-40 bg-yellow-500 text-black text-center py-2 font-bold text-sm animate-pulse px-3">
                    🏆 {lastEvent.data.winner.name} BINGO! Bạn có Bingo trùng không? Bấm KINH ngay!
                    {coWinners.length > 0 && (
                        <span className="ml-2 text-xs">({coWinners.join(', ')} cũng trùng)</span>
                    )}
                </div>
            )}

            {/* Winner Modal */}
            {winnerInfo && <WinnerModal winnerName={winnerInfo.name} isMe={winnerInfo.isMe} coWinners={winnerInfo.coWinners} onClose={() => setWinnerInfo(null)} />}

            {/* Alert Modal */}
            {alertInfo && <AlertModal message={alertInfo.message} type={alertInfo.type} onClose={handleAlertClose} />}

            {/* Host Disconnect Overlay */}
            {disconnectCountdown !== null && (
                <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-6 text-center">
                    <div className="text-6xl mb-4">🔌</div>
                    <h2 className="text-2xl font-bold text-red-500 mb-2">Mất Kết Nối Với Chủ Phòng!</h2>

                    {disconnectCountdown > 0 ? (
                        <>
                            <p className="text-slate-300 mb-4">Tự động rời phòng sau...</p>
                            <div className="text-5xl font-bold text-white">{disconnectCountdown}</div>
                        </>
                    ) : (
                        <div className="animate-pulse">
                            <p className="text-xl text-white font-bold mb-2">Chủ phòng đã thoát!</p>
                            <p className="text-slate-400">Đang quay về trang chủ...</p>
                        </div>
                    )}
                </div>
            )}

            {/* Main Content */}
            <div className="pt-28 pb-32 max-w-lg mx-auto">

                {/* State: Selecting Ticket */}
                {!myTickets || myTickets.length === 0 ? (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            {previousSetId ? (
                                <button
                                    onClick={() => {
                                        actions.selectSet(previousSetId);
                                        setPreviousSetId(null);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-bold text-slate-300 transition-all"
                                >
                                    ← Quay lại
                                </button>
                            ) : <div></div>}
                            <h2 className="text-xl font-bold text-center flex-1">Chọn Bộ Vé</h2>
                            {previousSetId ? <div className="w-20"></div> : <div></div>}
                        </div>

                        {previousSetId && (
                            <div className="mb-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600 text-center">
                                <span className="text-slate-400 text-sm">Đang giữ vé </span>
                                <span className="font-bold text-cyan-400">Set #{previousSetId}</span>
                                <span className="text-slate-400 text-sm"> • Chọn vé khác hoặc bấm "Quay lại"</span>
                            </div>
                        )}

                        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                            {availableSets.map((set) => {
                                const colorMap: Record<string, string> = {
                                    red: 'rgba(239, 68, 68, 0.6)',
                                    orange: 'rgba(249, 115, 22, 0.6)',
                                    purple: 'rgba(168, 85, 247, 0.6)',
                                    green: 'rgba(34, 197, 94, 0.6)',
                                    blue: 'rgba(59, 130, 246, 0.6)',
                                    yellow: 'rgba(234, 179, 8, 0.6)',
                                    pink: 'rgba(236, 72, 153, 0.6)',
                                    cyan: 'rgba(6, 182, 212, 0.6)',
                                    teal: 'rgba(20, 184, 166, 0.6)',
                                    indigo: 'rgba(99, 102, 241, 0.6)',
                                    lime: 'rgba(132, 204, 22, 0.6)',
                                    'lime green': 'rgba(132, 204, 22, 0.6)'
                                };
                                const bgColor = colorMap[set.color?.toLowerCase()] || 'rgba(59, 130, 246, 0.6)';

                                return (
                                    <button
                                        key={set.id}
                                        disabled={set.isTaken}
                                        onClick={() => {
                                            actions.selectSet(set.id);
                                            setPreviousSetId(null);
                                        }}
                                        style={{ backgroundColor: set.isTaken ? '' : bgColor }}
                                        className={clsx(
                                            "p-4 rounded-lg font-bold text-lg transition-all shadow-md",
                                            set.isTaken
                                                ? "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                                                : "text-white hover:scale-105 hover:shadow-lg"
                                        )}
                                    >
                                        {set.id}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* Playing */
                    <div className="space-y-6">
                        {gameState === 'WAITING' && (
                            <div className="bg-slate-800 p-4 rounded-xl flex items-center justify-between border border-slate-700">
                                <div>
                                    <p className="text-slate-400 text-sm">Vé Đã Chọn</p>
                                    <p className="font-bold text-lg">Set #{mySetId}</p>
                                </div>

                                <div className="flex gap-2">
                                    {!isReady && (
                                        <button
                                            onClick={() => {
                                                if (mySetId) setPreviousSetId(mySetId);
                                                actions.leaveSeat();
                                            }}
                                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold text-slate-300"
                                        >
                                            Đổi Vé
                                        </button>
                                    )}
                                    <button
                                        onClick={actions.toggleReady}
                                        className={clsx(
                                            "px-6 py-2 rounded font-bold transition-all shadow-lg",
                                            isReady ? "bg-green-600 hover:bg-green-700" : "bg-pink-600 hover:bg-pink-500 animate-pulse"
                                        )}
                                    >
                                        {isReady ? "SẴN SÀNG!" : "TÔI SẴN SÀNG"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {Array.isArray(myTickets) && myTickets.map((ticketData, idx) => (
                            <Ticket
                                key={idx}
                                data={ticketData}
                                markedNumbers={markedNumbers}
                                onNumberClick={handleNumberClick}
                                color={myTicketColor || 'blue'}
                            />
                        ))}

                        {/* Footer - Mobile Optimized */}
                        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-800/98 to-slate-800/90 border-t border-slate-700 z-20 safe-area-inset-bottom">
                            <div className="max-w-lg mx-auto px-4 py-3">
                                {/* Marked Count */}
                                <div className="text-center mb-2">
                                    <span className="text-sm text-slate-400">Đã đánh: </span>
                                    <span className="text-xl font-bold text-yellow-400">{markedNumbers.length}</span>
                                    <span className="text-sm text-slate-500"> số</span>
                                </div>

                                {/* Action Buttons Row */}
                                <div className="flex gap-3 items-center justify-center">
                                    {/* Drawn Button */}
                                    <button
                                        onClick={() => setShowDrawnNumbers(true)}
                                        className="w-12 h-12 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-lg border border-slate-600"
                                        title="Xem số đã rút"
                                    >
                                        📋
                                    </button>

                                    {/* KINH Button */}
                                    <button
                                        onClick={handleKinh}
                                        disabled={markedNumbers.length === 0 || gameState === 'ENDED' || winnerInfo !== null || (gameState !== 'PLAYING' && gameState !== 'PAUSED' && gameState !== 'BINGO_WINDOW')}
                                        className={clsx(
                                            "flex-1 max-w-[200px] py-4 rounded-xl font-bold text-xl transition-all",
                                            markedNumbers.length > 0 && !winnerInfo && (gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'BINGO_WINDOW')
                                                ? gameState === 'BINGO_WINDOW'
                                                    ? "bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-500 text-black shadow-lg shadow-yellow-500/50 animate-bounce"
                                                    : "bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white shadow-lg shadow-orange-500/30 animate-pulse"
                                                : "bg-slate-700 text-slate-500 cursor-not-allowed"
                                        )}
                                    >
                                        🎯 KINH!
                                    </button>

                                    {/* Placeholder */}
                                    <div className="w-12 h-12"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerRoom;
