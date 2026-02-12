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
            <div className="space-y-6">
                <section>
                    <h3 className="text-xl font-bold text-yellow-500 mb-2">📜 Luật Chơi</h3>
                    <ul className="list-disc pl-5 space-y-2 text-slate-300">
                        <li>
                            <strong className="text-white">Host (Chủ phòng):</strong> Người tạo phòng, điều khiển quay số và xác nhận kết quả.
                        </li>
                        <li>
                            <strong className="text-white">Player (Người chơi):</strong> Tham gia phòng, chọn bộ vé và dò số.
                        </li>
                        <li>
                            <strong className="text-white">Cách thắng (Bingo):</strong> Khi bạn có đủ <strong>5 số trên một hàng ngang</strong> bất kỳ trên vé của mình.
                        </li>
                        <li>
                            <strong className="text-white">Kinh (Báo thắng):</strong> Khi có Bingo, bấm ngay nút <strong>"KINH"</strong> để báo hiệu! Host sẽ kiểm tra vé của bạn.
                        </li>
                    </ul>
                </section>

                <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                    <p className="text-center italic text-slate-400">
                        "Chúc các bạn chơi vui vẻ và may mắn! Đừng quên bật loa để nghe hô số nhé." - Team 9h
                    </p>
                </div>

                {/* Donation Section */}
                <section className="bg-gradient-to-r from-pink-900/50 to-purple-900/50 p-4 rounded-lg border border-pink-700/50">
                    <h3 className="text-lg font-bold text-pink-400 mb-2 flex items-center gap-2">
                        🧧 Ủng Hộ
                    </h3>
                    <p className="text-slate-300 text-sm mb-3">
                        Nếu thấy vui, hãy ủng hộ team ly cà phê nhé! Cảm ơn các bạn rất nhiều ❤️
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                        <div className="bg-white p-2 rounded-lg shadow-lg">
                            {/* QR Code */}
                            <div className="w-32 h-32 overflow-hidden rounded bg-gray-100 relative flex items-center justify-center">
                                <img
                                    src="/donation-qr.jpg"
                                    alt="QR Code"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        </div>
                        <div className="text-sm space-y-2">
                            <p><strong className="text-pink-400">Momo:</strong> <span className="font-mono text-white text-base">0363839007</span></p>
                            <p><strong className="text-blue-400">Bank (ACB):</strong> <span className="font-mono text-white text-base">12342467</span> <br /><span className="text-xs text-slate-400">Đặng Ngọc Chính</span></p>
                            <p className="text-xs text-slate-500 italic mt-2 border-t border-slate-700/50 pt-2">* Nội dung: Loto + Tên bạn</p>
                        </div>
                    </div>
                </section>

                {/* Release Notes */}
                <section className="border-t border-slate-700 pt-4">
                    <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Lịch Sử Cập Nhật</h4>
                    <div className="text-xs text-slate-500 space-y-1 font-mono">
                        <p><span className="text-cyan-400">v1.2.1</span> (2026-02-12): Hotfix: Sửa lỗi đồng bộ Bảng Vàng.</p>
                        <p><span className="text-cyan-400">v1.2.0</span> (2026-02-12): Giao diện Mobile mới, Xác nhận thoát game, Sửa lỗi kết nối & Tự động thoát khi mất Host.</p>
                        <p><span className="text-cyan-400">v1.1.0</span> (2026-02-12): Chuyển đổi TypeScript & Tái cấu trúc code.</p>
                        <p><span className="text-cyan-400">v1.0.2</span> (2026-02-04): Sửa lỗi crash mobile, cải thiện giao diện.</p>
                        <p><span className="text-cyan-400">v1.0.1</span> (2026-02-03): Thêm xuất CSV, Giao diện Responsive, Sửa lỗi logic game.</p>
                    </div>
                </section>

                <div className="pt-2">
                    <PrimaryButton onClick={onClose}>
                        ĐÃ HIỂU, VÀO GAME THÔI! 🚀
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    );
};

export default IntroModal;
