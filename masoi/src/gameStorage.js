/**
 * Tiện ích quản lý localStorage cho game Ma Sói
 * Lưu toàn bộ trạng thái game vào một key duy nhất: 'masoi_game'
 */

const STORAGE_KEY = 'masoi_game';

// ===== CẤU TRÚC DỮ LIỆU MẶC ĐỊNH =====

/**
 * @typedef {Object} Player
 * @property {string} id - ID duy nhất
 * @property {string} name - Tên người chơi
 * @property {string} role - Vai trò (role key)
 * @property {boolean} isAlive - Còn sống?
 * @property {boolean} isEliminated - Bị treo cổ hoặc bị giết?
 * @property {boolean} hasVoted - Đã vote chưa?
 * @property {string|null} voteTarget - Đang vote cho ai
 * @property {string} joinedAt - Thời điểm tham gia
 */

/**
 * @typedef {Object} NightEvent
 * @property {number} night - Đêm thứ mấy
 * @property {string|null} bitten - ID người bị cắn
 * @property {string|null} healed - ID người được cứu
 * @property {string|null} killed - ID người chết thực sự
 * @property {string|null} seen - ID người bị Tiên Tri xem
 * @property {string|null} seenRole - Role của người bị xem
 * @property {string|null} shot - ID người bị Thợ Săn bắn
 * @property {string|null} hanged - ID người bị treo cổ ngày đó
 */

/**
 * @typedef {Object} GameState
 * @property {string} roomId - ID phòng
 * @property {string} status - waiting|role_dealing|night|day|discussion|voting|ended
 * @property {Player[]} players - Danh sách người chơi
 * @property {string[]} selectedRoles - Các role được chọn
 * @property {NightEvent[]} history - Lịch sử từng đêm
 * @property {NightEvent} currentNight - Đêm hiện tại
 * @property {Object} previousGame - Kết quả ván trước
 * @property {number} nightCount - Đêm thứ mấy rồi
 * @property {number} dayCount - Ngày thứ mấy
 * @property {number} discussionTime - Thời gian thảo luận (giây)
 * @property {string} winner - wolves|villagers|'' - Ai thắng
 * @property {string} publicLog - Log công khai
 */

export const defaultGameState = () => ({
    roomId: Math.floor(100 + Math.random() * 900).toString(), // 3 digits: 100-999
    status: 'waiting',
    players: [],
    selectedRoles: [],
    history: [],
    currentNight: null,
    previousGame: null,
    nightCount: 0,
    dayCount: 0,
    discussionTime: 150, // 2:30 theo Stitch mockup
    winner: '',
    publicLog: [],
    votingResults: {},
    hostId: null,
    pendingHunterShotId: null,
    createdAt: Date.now(),
    roleCounts: {
        WEREWOLF: 2,
        SEER: 1,
        DOCTOR: 1,
        HUNTER: 1,
        VILLAGER: 3,
    },
});

// ===== UTILITIES =====

/** Generate unique player ID (crypto.randomUUID when available) */
export function generatePlayerId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
}

// ===== ĐỌC / GHI =====

export function getGameState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function setGameState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...state,
            updatedAt: Date.now(),
        }));
        // Trigger event để các tab/component khác biết có thay đổi
        window.dispatchEvent(new Event('masoi_update'));
    } catch (e) {
        console.error('Lỗi lưu localStorage:', e);
    }
}

export function updateGameState(updater) {
    const current = getGameState() || defaultGameState();
    const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    setGameState(next);
    return next;
}

export function clearGameState() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('masoi_update'));
}

// ===== ĐỊNH NGHĨA CÁC ROLE CHUẨN (STITCH UI) =====

export const ROLES = {
    WEREWOLF: {
        key: 'WEREWOLF',
        name: 'Werewolf',
        side: 'wolves',
        icon: '🐺',
        color: '#dc2626', // bg-red-600
        bgColor: 'rgba(220,38,38,0.1)',
        borderColor: 'rgba(220,38,38,0.2)',
        description: 'Awakens at night to eliminate a player.',
        playerDescription: 'You wake up every night to hunt the villagers.',
        nightAction: true,
    },
    SEER: {
        key: 'SEER',
        name: 'Seer',
        side: 'villagers',
        icon: '👁️',
        color: '#2563eb', // text-blue-600
        bgColor: 'rgba(37,99,235,0.1)',
        borderColor: 'rgba(37,99,235,0.2)',
        description: 'Discovers the true identity of one player per night.',
        playerDescription: 'Check one player\'s alignment each night.',
        nightAction: true,
    },
    DOCTOR: {
        key: 'DOCTOR',
        name: 'Doctor',
        side: 'villagers',
        icon: '💊',
        color: '#16a34a', // text-green-600
        bgColor: 'rgba(22,163,74,0.1)',
        borderColor: 'rgba(22,163,74,0.2)',
        description: 'Protects one player from elimination each night.',
        playerDescription: 'Protect one player from being killed each night.',
        nightAction: true,
    },
    HUNTER: {
        key: 'HUNTER',
        name: 'Hunter',
        side: 'villagers',
        icon: '🎯',
        color: '#d97706', // text-amber-600
        bgColor: 'rgba(217,119,6,0.1)',
        borderColor: 'rgba(217,119,6,0.2)',
        description: 'If eliminated, takes one player down with them.',
        playerDescription: 'Takes someone down with them if eliminated.',
        nightAction: false,
    },
    VILLAGER: {
        key: 'VILLAGER',
        name: 'Villager',
        side: 'villagers',
        icon: '🌾',
        color: '#9ca3af', // text-gray-400
        bgColor: 'rgba(156,163,175,0.1)',
        borderColor: 'rgba(156,163,175,0.2)',
        description: 'No special abilities. Tries to find the werewolves.',
        playerDescription: 'Has no special abilities. Relies on logic.',
        nightAction: false,
    },
};

// ===== LOGIC GAME =====

/** Xáo bài và phát role cho người chơi */
export function dealRoles(players, selectedRoles) {
    const roles = [...selectedRoles];
    // Điền đủ Dân Làng nếu thiếu
    while (roles.length < players.length) {
        roles.push('VILLAGER');
    }
    // Cắt bớt nếu thừa
    roles.splice(players.length);

    // Shuffle Fisher-Yates
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    return players.map((p, idx) => ({
        ...p,
        role: roles[idx],
        isAlive: true,
        isEliminated: false,
        hasVoted: false,
        voteTarget: null,
    }));
}

/** Lưu kết quả ván hiện tại vào history trước khi reset hoặc đổi trạng thái */
export function archiveGame(state) {
    if (!state) return state;
    return {
        ...state,
        previousGame: {
            players: [...(state.players || [])],
            winner: state.winner,
            endedAt: new Date().toISOString(),
            logs: [...(state.publicLog || [])]
        }
    };
}

/** Kiểm tra điều kiện thắng */
// ... existing code ...
export function checkWinCondition(players) {
    const alive = players.filter(p => p.isAlive);
    const wolves = alive.filter(p => ROLES[p.role]?.side === 'wolves');
    const villagers = alive.filter(p => ROLES[p.role]?.side === 'villagers');

    if (wolves.length === 0) return 'villagers';
    if (wolves.length >= villagers.length) return 'wolves';
    return '';
}

/** Tổng hợp kết quả vote */
export function tallyVotes(players) {
    const tally = {};
    players.forEach(p => {
        if (p.isAlive && p.voteTarget) {
            tally[p.voteTarget] = (tally[p.voteTarget] || 0) + 1;
        }
    });
    // Tìm người bị vote nhiều nhất
    let maxVotes = 0;
    let mostVoted = null;
    const entries = Object.entries(tally);
    entries.forEach(([id, votes]) => {
        if (votes > maxVotes) {
            maxVotes = votes;
            mostVoted = id;
        }
    });
    // Kiểm tra hòa
    const ties = entries.filter(([, v]) => v === maxVotes);
    return { tally, mostVoted: ties.length > 1 ? null : mostVoted, maxVotes, isTie: ties.length > 1 };
}

/** Thêm log công khai */
export function addPublicLog(state, message) {
    const log = {
        id: Date.now(),
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        message,
        phase: state.status,
        night: state.nightCount,
        day: state.dayCount,
    };
    return {
        ...state,
        publicLog: [log, ...(state.publicLog || [])].slice(0, 50),
    };
}
