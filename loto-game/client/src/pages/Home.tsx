import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import IntroModal from '../components/IntroModal';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const [roomId, setRoomId] = useState<string>('');
    const [name, setName] = useState<string>('');
    const [showIntro, setShowIntro] = useState(false);

    const createRoom = () => {
        // Generate a random 3-digit room ID (numbers only)
        const newRoomId = String(Math.floor(100 + Math.random() * 900));
        navigate(`/${newRoomId}/host`);
    };

    const joinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomId || !name) return;

        // Navigate to player room with state
        navigate(`/${roomId}/play`, {
            state: { name }
        });
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-slate-900">
            <div className="w-full max-w-md bg-slate-800 p-8 rounded-xl shadow-2xl text-center">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-500 mb-8">
                    LOTO ONLINE
                </h1>

                <div className="mb-8">
                    <button
                        onClick={createRoom}
                        className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg font-bold text-xl hover:scale-105 transition-transform shadow-lg text-white"
                    >
                        Tạo Phòng Mới
                    </button>
                </div>

                <div className="relative flex py-5 items-center">
                    <div className="flex-grow border-t border-slate-600"></div>
                    <span className="flex-shrink mx-4 text-slate-400">HOẶC</span>
                    <div className="flex-grow border-t border-slate-600"></div>
                </div>

                <form onSubmit={joinRoom} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Tên của bạn"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full p-3 bg-slate-700 rounded-lg border border-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all text-white placeholder-slate-400"
                        required
                    />
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Mã Phòng"
                            value={roomId}
                            onChange={e => setRoomId(e.target.value)}
                            className="flex-1 p-3 bg-slate-700 rounded-lg border border-slate-600 uppercase focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all text-white placeholder-slate-400"
                            maxLength={3}
                            required
                        />
                        <button
                            type="submit"
                            className="px-6 bg-pink-600 hover:bg-pink-700 rounded-lg font-bold transition-colors text-white"
                        >
                            Tham Gia
                        </button>
                    </div>
                </form>
            </div>

            {/* Info Button - Fixed bottom right */}
            <button
                onClick={() => setShowIntro(true)}
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 hover:from-orange-300 hover:to-orange-500 flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 border border-orange-300/50 z-50"
                title="Hướng dẫn & Ủng hộ"
            >
                <span className="text-2xl font-bold font-serif italic">i</span>
            </button>

            {/* Footer */}
            <div className="absolute bottom-4 left-0 right-0 text-center text-slate-500 text-sm font-medium pointer-events-none">
                From Pe Thúi Loto Online with ❤️ | v1.5.1
            </div>

            {/* Intro Modal */}
            {showIntro && <IntroModal onClose={() => setShowIntro(false)} />}
        </div>
    );
};

export default Home;
