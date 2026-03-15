# Ma Sói — Tech Debt + Improvement Plan

## 1. Tech Debt (Nợ kỹ thuật)

### 1.1 CSS / Styling

| ID | Issue | Impact | Location |
|----|-------|--------|----------|
| TD-1 | Thiếu CSS variables: `--background`, `--border`, `--accent-red`, `--accent-green`, `--accent-purple`, `--text-inactive`, `--surface-hover` — components dùng nhưng không khai báo trong `:root` | Style broken / fallback không đúng | `index.css`, `HostDashboard`, `HostSetup`, `PlayerScreen`, `Timer` |
| TD-2 | `input-field` class dùng trong HostSetup nhưng CSS chỉ có `input-dark` | Input không style đúng | `HostSetup.jsx:172` |
| TD-3 | `animate-scaleIn` keyframe không tồn tại — RoleCard dùng nhưng chưa define | Animation không chạy | `PlayerScreen.jsx:157`, `index.css` |
| TD-4 | `scrollbar-hide` dùng nhưng không define trong CSS | Scrollbar vẫn hiển thị | `HostDashboard.jsx`, Tailwind cần plugin hoặc utility |

### 1.2 Logic / Game Rules

| ID | Issue | Impact | Location |
|----|-------|--------|----------|
| TD-5 | Hunter (`shot`) chưa implement — khi Hunter chết phải chọn 1 người bắn theo | Rule thiếu | `gameStorage.js`, `HostDashboard.jsx`, `PlayerScreen.jsx` |
| TD-6 | `archiveGame` không gọi trong `hangPlayer` khi game ended — chỉ `nextPhase` → day gọi | Inconsistent, có thể mất history | `HostDashboard.jsx:115-144` |
| TD-7 | Multi-wolf voting: 2 Sói vote khác người → logic chưa rõ (first? majority? random?) | Rule ambiguous | `gameStorage.js`, night phase |

### 1.3 State / Sync

| ID | Issue | Impact | Location |
|----|-------|--------|----------|
| TD-8 | Player ID dùng `Date.now().toString()` — có thể trùng nếu thêm 2 player trong cùng ms | Collision, bug rare | `HostSetup.jsx`, `PlayerScreen.jsx` |
| TD-9 | `nextPhase` useCallback dependency thiếu `players` — closure có thể stale | Potential bug khi phase transition | `HostDashboard.jsx:80` |
| TD-10 | Timer `useEffect` dependency `onEnd` — mỗi lần re-render tạo hàm mới → interval reset | Timer có thể bị restart không mong muốn | `Timer.jsx:30` |

### 1.4 Code Quality

| ID | Issue | Impact | Location |
|----|-------|--------|----------|
| TD-11 | `clearGameState` import nhưng không dùng | Dead code | `App.jsx:6` |
| TD-12 | `tesseract.js` trong dependencies nhưng không dùng | Dead dependency, tăng bundle | `package.json` |
| TD-13 | Không có unit / integration test | Refactor rủi ro cao | Toàn project |
| TD-14 | `discussionTime` state trong HostSetup không có UI config — user không đổi được | UX thiếu | `HostSetup.jsx:11` |

---

## 2. Improvement Points

### 2.1 Architecture & Maintainability

| ID | Improvement | Benefit |
|----|-------------|---------|
| IMP-1 | Tách game logic thành `gameReducer` hoặc store riêng (Zustand/Jotai) thay vì trực tiếp `updateGameState` | Dễ test, dễ mở rộng |
| IMP-2 | Migrate sang TypeScript | Type safety, maintainability |
| IMP-3 | Tách constants (`PHASE_LABELS`, `ROLES`, `SCREENS`) ra file riêng | Single source of truth |
| IMP-4 | Error boundary cho crash handling | Better UX khi lỗi |

### 2.2 UX / Accessibility

| ID | Improvement | Benefit |
|----|-------------|---------|
| IMP-5 | i18n (en/vi) cho toàn bộ UI | Đa ngôn ngữ |
| IMP-6 | Config `discussionTime` trong HostSetup với slider/input | Host có thể tùy chỉnh |
| IMP-7 | A11y: aria-labels, focus management, screen reader | Inclusive |
| IMP-8 | Sound effects cho phase change, vote, reveal | Immersive |
| IMP-9 | Phase transition animations | Polished UX |

### 2.3 Features

| ID | Improvement | Benefit |
|----|-------------|---------|
| IMP-10 | PWA / offline-first với service worker | Chơi không cần mạng ổn định |
| IMP-11 | Share room link (Web Share API) | Dễ mời player |
| IMP-12 | Dark/Light theme toggle | Preference |
| IMP-13 | Game replay / history export | Review, share |

### 2.4 Performance & DX

| ID | Improvement | Benefit |
|----|-------------|---------|
| IMP-14 | Lazy load components (HostDashboard, PlayerScreen) | Giảm initial bundle |
| IMP-15 | Thay `crypto.randomUUID()` cho player ID | Không trùng |
| IMP-16 | Add Vitest + React Testing Library | Regression prevention |
| IMP-17 | Remove `tesseract.js` nếu không dùng | Giảm bundle |

---

## 3. Implementation Plan (Ưu tiên)

### Phase 1: Critical Fixes (1–2 ngày)
> Sửa bug và tech debt ảnh hưởng trực tiếp tới gameplay / build

| Order | Task | Ref | Effort |
|-------|------|-----|--------|
| 1 | Bổ sung CSS variables thiếu vào `:root` | TD-1 | S |
| 2 | Sửa `input-field` → `input-dark` hoặc thêm `.input-field` | TD-2 | S |
| 3 | Thêm keyframe `scaleIn` hoặc đổi class | TD-3 | S |
| 4 | Thêm `scrollbar-hide` utility (Tailwind hoặc CSS) | TD-4 | S |
| 5 | Implement Hunter `shot` khi bị treo/bị giết | TD-5 | M |
| 6 | Gọi `archiveGame` trong `hangPlayer` khi ended | TD-6 | S |
| 7 | Sửa Timer `onEnd` dependency (useRef) | TD-10 | S |
| 8 | Dùng `crypto.randomUUID()` hoặc nanoid cho player ID | TD-8, IMP-15 | S |
| 9 | Remove `clearGameState` unused import | TD-11 | S |
| 10 | Remove `tesseract.js` nếu không dùng | TD-12, IMP-17 | S |

### Phase 2: UX & Config (1 ngày)
> Cải thiện trải nghiệm host/player

| Order | Task | Ref | Effort |
|-------|------|-----|--------|
| 11 | Thêm UI config `discussionTime` trong HostSetup | TD-14, IMP-6 | S |
| 12 | Define rõ multi-wolf voting (majority / first) và implement | TD-7 | M |
| 13 | Fix `nextPhase` dependencies / stale closure | TD-9 | S |
| 14 | Phase transition animation nhẹ | IMP-9 | S |

### Phase 3: Structure & Quality (2–3 ngày)
> Tái cấu trúc để dễ bảo trì

| Order | Task | Ref | Effort |
|-------|------|-----|--------|
| 15 | Tách constants (`ROLES`, `PHASE_LABELS`, v.v.) ra `constants/` | IMP-3 | S |
| 16 | Game reducer / store (Zustand) cho logic | IMP-1 | L |
| 17 | Error boundary | IMP-4 | S |
| 18 | Setup Vitest + viết test cho `gameStorage` | TD-13, IMP-16 | M |
| 19 | Lazy load HostDashboard, PlayerScreen | IMP-14 | S |

### Phase 4: Enhancements (Optional)
> Features mở rộng

| Order | Task | Ref | Effort |
|-------|------|-----|--------|
| 20 | i18n (vi/en) | IMP-5 | M |
| 21 | PWA + service worker | IMP-10 | M |
| 22 | TypeScript migration | IMP-2 | L |
| 23 | Share room link (Web Share API) | IMP-11 | S |
| 24 | Sound effects | IMP-8 | M |
| 25 | A11y improvements | IMP-7 | M |

---

## 4. Task List (Checklist)

### Phase 1 — Critical

- [x] **T1.1** Thêm `--background`, `--border`, `--accent-red`, `--accent-green`, `--accent-purple`, `--text-inactive`, `--surface-hover` vào `index.css`
- [x] **T1.2** Thêm `.input-field` alias (giữ nguyên class trong HostSetup)
- [x] **T1.3** Thêm `@keyframes scaleIn` và `.animate-scaleIn` trong CSS
- [x] **T1.4** Thêm `.scrollbar-hide` trong CSS
- [x] **T1.5** Implement Hunter shot: khi Hunter chết (hang/kill) → Host chọn target → set `currentNight.shot`
- [x] **T1.6** Gọi `archiveGame(next)` trong `hangPlayer` khi `winner` set
- [x] **T1.7** Timer: wrap `onEnd` trong `useRef` để không re-run effect
- [x] **T1.8** Player ID: `generatePlayerId()` với `crypto.randomUUID` fallback
- [x] **T1.9** Remove `clearGameState` từ App.jsx import
- [x] **T1.10** Remove `tesseract.js` từ package.json

### Phase 2 — UX

- [x] **T2.1** Thêm slider `discussionTime` (60–300s) trong HostSetup
- [ ] **T2.2** Implement multi-wolf rule (ví dụ: first vote wins, hoặc majority)
- [x] **T2.3** Fix `nextPhase` useCallback deps (dùng s.players thay vì players)
- [x] **T2.4** Thêm fade animation cho phase change

### Phase 3 — Structure

- [ ] **T3.1** Tạo `src/constants/game.js` (ROLES, PHASES, SCREENS)
- [ ] **T3.2** Tạo `src/stores/gameStore.js` (Zustand) hoặc reducer
- [ ] **T3.3** Thêm `ErrorBoundary` và wrap App
- [ ] **T3.4** Vitest setup + test `dealRoles`, `checkWinCondition`, `tallyVotes`
- [ ] **T3.5** React.lazy cho HostDashboard, PlayerScreen

### Phase 4 — Optional

- [ ] **T4.1** i18n với react-i18next
- [ ] **T4.2** PWA manifest + service worker (vite-plugin-pwa)
- [ ] **T4.3** Migrate to TypeScript (incremental)
- [ ] **T4.4** Web Share API cho room link
- [ ] **T4.5** Sound cues cho phase/vote
- [ ] **T4.6** A11y: aria, focus, contrast

---

## 5. CSS Variables Cần Thêm

```css
:root {
  /* Đã có: --blood, --blood-light, --host-color, --host-light, --midnight, --surface, --surface2, --border-light, --text-primary, --text-muted */
  
  --background: #181112;  /* = midnight */
  --border: rgba(255, 255, 255, 0.08);
  --surface-hover: rgba(255, 255, 255, 0.06);
  --text-inactive: #64748b;
  --accent-red: #ef4444;
  --accent-green: #22c55e;
  --accent-purple: #a855f7;
}
```

---

## 6. Multi-Wolf Voting Rule (Đề xuất)

**Option A (đơn giản):** Wolves vote tuần tự theo thứ tự host chọn → target cuối cùng được áp dụng.

**Option B (recommended):** Tất cả wolves chọn qua app → majority wins; nếu tie → random trong số bị vote.

Cần update `HuntPhase` cho player Wolf: hiển thị danh sách target và ghi nhận `voteTarget` của từng wolf, rồi aggregate ở Host khi "Wake Up Village".

---

*Document version: 1.0 | Last updated: 2026-03-08*
