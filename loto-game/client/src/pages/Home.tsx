import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../components/ui/Button';

const Home: React.FC = () => {
    const navigate = useNavigate();
    // const [roomId, setRoomId] = useState<string>(''); // Unused

    const [joinRoomId, setJoinRoomId] = useState<string>('');

    const createRoom = () => {
        // Generate a random room ID (or use UI to let user pick?)
        // For simplicity, generate one.
        // In real app, Host request server to create room.
        // Here we just use client-generated ID for demo or rely on HostRoom to init.
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        navigate(`/host/${newRoomId}`);
    };

    const joinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (joinRoomId.trim()) {
            navigate(`/room/${joinRoomId.toUpperCase()}`);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black -z-10"></div>
            <div className="absolute w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl -top-32 -left-32 animate-pulse"></div>
            <div className="absolute w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl bottom-0 right-0 animate-pulse delay-1000"></div>

            <main className="z-10 text-center space-y-12 max-w-lg w-full">

                {/* Hero Section */}
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="inline-block relative">
                        <span className="text-8xl animate-bounce inline-block">🍲</span>
                        <span className="absolute -bottom-2 -right-2 text-4xl animate-pulse">🎲</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-lg">
                        SÚP LƠ LOTO
                    </h1>
                    <p className="text-slate-400 text-lg md:text-xl font-medium">
                        Game Loto Online "xịn xò" nhất vịnh Bắc Bộ!
                    </p>
                </div>

                {/* Action Cards */}
                <div className="grid gap-6 w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">

                    {/* Create Room */}
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:border-cyan-500/50 transition-all group">
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                            👑 Dành cho Host
                        </h2>
                        <p className="text-slate-400 text-sm mb-4">Tạo phòng mới và mời bạn bè vào chơi ngay.</p>
                        <PrimaryButton
                            onClick={createRoom}
                            className="w-full text-lg py-3 bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all transform group-hover:-translate-y-0.5"
                        >
                            TẠO PHÒNG MỚI +
                        </PrimaryButton>
                    </div>

                    {/* Join Room */}
                    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl hover:border-green-500/50 transition-all group">
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                            👋 Dành cho Người Chơi
                        </h2>
                        <form onSubmit={joinRoom} className="space-y-3">
                            <input
                                type="text"
                                placeholder="Nhập Mã Phòng (ví dụ: ABC123)"
                                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none text-center text-lg font-mono tracking-widest uppercase transition-all"
                                value={joinRoomId}
                                onChange={(e) => setJoinRoomId(e.target.value)}
                            />
                            <SecondaryButton
                                type="submit"
                                className="w-full text-lg py-3 border-slate-600 text-slate-300 hover:text-white hover:border-white hover:bg-slate-700 transition-all"
                                disabled={!joinRoomId.trim()}
                            >
                                VÀO PHÒNG NGAY 🚀
                            </SecondaryButton>
                        </form>
                    </div>
                </div>
            </main>

            <footer className="absolute bottom-4 text-center text-slate-600 text-xs">
                © 2024 Súp Lơ Team. All rights reserved. Made with ❤️ and ☕.
            </footer>
        </div>
    );
};

export default Home;
