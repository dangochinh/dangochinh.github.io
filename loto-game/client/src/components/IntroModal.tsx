import React from 'react';
import Modal from './ui/Modal';
import { PrimaryButton } from './ui/Button';

interface IntroModalProps {
    onClose: () => void;
}

const IntroModal: React.FC<IntroModalProps> = ({ onClose }) => {
    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Team 9h - LOTO ONLINE 🍲"
            className="max-w-2xl"
        >
            <div className="flex flex-col" style={{ maxHeight: 'calc(80vh - 80px)' }}>
                {/* Scrollable content */}
                <div className="space-y-4 overflow-y-auto flex-1 pb-2 pr-1 -mr-1">
                    {/* 1. Cách Chơi */}
                    <section>
                        <h3 className="text-lg sm:text-xl font-bold text-yellow-500 mb-2">📜 Luật Chơi</h3>
                        <ul className="list-disc pl-4 space-y-1 text-sm text-slate-300">
                            <li>
                                <strong className="text-white">Host:</strong> Tạo phòng, điều khiển quay số, xác nhận kết quả.
                            </li>
                            <li>
                                <strong className="text-white">Player:</strong> Tham gia phòng, chọn bộ vé và dò số.
                            </li>
                            <li>
                                <strong className="text-white">Bingo:</strong> Có đủ <strong>5 số trên 1 hàng ngang</strong> bất kỳ trên vé.
                            </li>
                            <li>
                                <strong className="text-white">Kinh:</strong> Khi có Bingo, bấm <strong>"KINH"</strong> để báo hiệu!
                            </li>
                        </ul>
                    </section>

                    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                        <p className="text-center italic text-slate-400 text-xs sm:text-sm">
                            "Chúc các bạn chơi vui vẻ và may mắn! Đừng quên bật loa để nghe hô số nhé." - Team 9h
                        </p>
                    </div>

                    {/* 2. Lịch Sử Cập Nhật */}
                    <section className="border-t border-slate-700 pt-3">
                        <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Lịch Sử Cập Nhật</h4>
                        <div className="text-xs text-slate-500 space-y-1 font-mono leading-relaxed">
                            <p><span className="text-cyan-400">v1.5.1</span> (2026-02-28): Giới hạn thắng tối đa, Cân bằng thuật toán ván cứu.</p>
                            <p><span className="text-cyan-400">v1.5.0</span> (2026-02-26): Mã phòng 3 số, Tự Động Dò tự tắt popup, Fix bug Bingo trùng lặp.</p>
                            <p><span className="text-cyan-400">v1.4.0</span> (2026-02-24): Tự kết nối lại, Nút info, Tự Động Dò cooldown 30s, Highlight 4/5.</p>
                            <p><span className="text-cyan-400">v1.3.0</span> (2026-02-22): Bingo Trùng & Chặn tham gia khi ván đang diễn ra.</p>
                            <p><span className="text-cyan-400">v1.2.0</span> (2026-02-12): Giao diện Mobile mới, Xác nhận thoát game, Sửa lỗi kết nối.</p>
                        </div>
                    </section>

                    {/* 3. Ủng Hộ */}
                    <section className="bg-gradient-to-r from-pink-900/50 to-purple-900/50 p-3 rounded-lg border border-pink-700/50">
                        <h3 className="text-base font-bold text-pink-400 mb-1 flex items-center gap-2">
                            🧧 Ủng Hộ
                        </h3>
                        <p className="text-slate-300 text-xs mb-2">
                            Nếu thấy vui, hãy ủng hộ team ly cà phê nhé! ❤️
                        </p>
                        <div className="flex flex-row gap-3 items-center justify-center">
                            <div className="bg-white p-1.5 rounded-lg shadow-lg shrink-0">
                                <div className="w-20 h-20 sm:w-28 sm:h-28 overflow-hidden rounded bg-gray-100 flex items-center justify-center">
                                    <img
                                        src="/donation-qr.jpg"
                                        alt="QR Code"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                </div>
                            </div>
                            <div className="text-xs space-y-1 text-left">
                                <p><strong className="text-pink-400">Momo:</strong> <span className="font-mono text-white">0363839007</span></p>
                                <p><strong className="text-blue-400">Bank (ACB):</strong> <span className="font-mono text-white">12342467</span><br /><span className="text-xs text-slate-400">Đặng Ngọc Chính</span></p>
                                <p className="text-xs text-slate-500 italic">* Nội dung: Loto + Tên bạn</p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Fixed bottom button - always visible */}
                <div className="pt-3 border-t border-slate-700 mt-2 shrink-0">
                    <PrimaryButton onClick={onClose}>
                        ĐÃ HIỂU, VÀO GAME THÔI! 🚀
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    );
};

export default IntroModal;
