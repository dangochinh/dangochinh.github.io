import React from 'react';

const IntroModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl transform animate-scaleIn relative overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    ✕
                </button>

                {/* Header */}
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-6 text-center">
                    Hướng Dẫn & Ủng Hộ
                </h2>

                <div className="space-y-6">
                    {/* Guide Section */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <h3 className="text-xl font-bold text-cyan-300 mb-2">📜 Cách Chơi</h3>
                        <ul className="list-disc list-inside text-slate-300 space-y-2 text-sm">
                            <li><strong>Chủ Phòng (Host):</strong> Tạo phòng, gửi Room ID cho bạn bè. Bấm "Start Game" để bắt đầu quay số.</li>
                            <li><strong>Người Chơi:</strong> Nhập Room ID & Tên để vào phòng. Chọn bộ vé ưng ý.</li>
                            <li><strong>Khi chơi:</strong> Host điều khiển quay số. Người chơi đánh dấu số trên vé.</li>
                            <li><strong>Báo KINH/BINGO:</strong> Khi đủ số hàng ngang (Kinh) hoặc đủ 3 hàng (Bingo), bấm nút báo ngay!</li>
                        </ul>
                    </div>

                    {/* Support Section */}
                    <div className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 p-4 rounded-xl border border-pink-500/30">
                        <h3 className="text-xl font-bold text-pink-300 mb-3 text-center">💖 Ủng Hộ Tác Giả</h3>
                        <p className="text-slate-300 text-center mb-4 text-sm">
                            Nếu bạn thấy game vui, hãy ủng hộ tác giả một ly cà phê nhé! 😍
                        </p>

                        <div className="flex flex-col gap-3">
                            {/* Momo */}
                            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-pink-500/20">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">💸</span>
                                    <div>
                                        <div className="font-bold text-pink-400">Momo</div>
                                        <div className="text-white font-mono text-lg">0363839007</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText('0363839007')}
                                    className="px-3 py-1 bg-pink-600 hover:bg-pink-700 rounded text-xs font-bold transition-colors"
                                >
                                    Copy
                                </button>
                            </div>

                            {/* ACB */}
                            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-blue-500/20">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🏦</span>
                                    <div>
                                        <div className="font-bold text-blue-400">ACB (Á Châu)</div>
                                        <div className="text-white font-mono text-lg">12342467</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText('12342467')}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-bold transition-colors"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Changelog Section */}
                    <div className="border-t border-slate-700 pt-4 mt-2">
                        <h4 className="text-sm font-bold text-slate-400 mb-2">🚀 Cập nhật v1.0.2 (11/02/2026 20:10)</h4>
                        <ul className="list-disc list-inside text-xs text-slate-500 space-y-1">
                            <li>Sửa lỗi tương thích "randomUUID" trên điện thoại Android/Samsung cũ.</li>
                            <li>Cập nhật bộ vé mới (3 vé/khung).</li>
                            <li>Tối ưu giao diện chọn vé (4 cột Mobile / 6 cột PC).</li>
                            <li>Cải thiện xuất file CSV (Thêm Status & Danh sách người chơi).</li>
                        </ul>
                    </div>
                </div>

                {/* Footer Button */}
                <button
                    onClick={onClose}
                    className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg transform transition-all hover:scale-[1.02] active:scale-95"
                >
                    Đã Hiểu, Chiến Thôi! 🚀
                </button>
            </div>
        </div>
    );
};

export default IntroModal;
