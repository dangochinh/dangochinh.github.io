/**
 * Simulation tests for Ma Sói game logic
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  dealRoles,
  checkWinCondition,
  tallyVotes,
  addPublicLog,
  archiveGame,
  ROLES,
  generatePlayerId,
} from './gameStorage';

// ===== Helper: create mock players =====
function makePlayers(names, roles = null) {
  return names.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    role: roles?.[i] ?? '',
    isAlive: true,
    isEliminated: false,
    hasVoted: false,
    voteTarget: null,
    joinedAt: new Date().toISOString(),
  }));
}

// ===== dealRoles =====
describe('dealRoles', () => {
  it('assigns exactly one role per player', () => {
    const players = makePlayers(['A', 'B', 'C', 'D']);
    const roles = ['WEREWOLF', 'VILLAGER', 'SEER', 'VILLAGER'];
    const dealt = dealRoles(players, roles);
    expect(dealt).toHaveLength(4);
    expect(dealt.every(p => p.role)).toBe(true);
    expect(new Set(dealt.map(p => p.role)).size).toBeGreaterThanOrEqual(1);
  });

  it('fills VILLAGER when roles < players', () => {
    const players = makePlayers(['A', 'B', 'C', 'D', 'E']);
    const roles = ['WEREWOLF', 'WEREWOLF', 'SEER'];
    const dealt = dealRoles(players, roles);
    const villagerCount = dealt.filter(p => p.role === 'VILLAGER').length;
    expect(villagerCount).toBe(2);
  });

  it('splices excess roles when roles > players', () => {
    const players = makePlayers(['A', 'B']);
    const roles = ['WEREWOLF', 'SEER', 'DOCTOR', 'HUNTER', 'VILLAGER'];
    const dealt = dealRoles(players, roles);
    expect(dealt).toHaveLength(2);
    expect(dealt.every(p => p.role && ['WEREWOLF', 'SEER', 'DOCTOR', 'HUNTER', 'VILLAGER'].includes(p.role))).toBe(true);
  });

  it('resets isAlive, isEliminated, hasVoted, voteTarget', () => {
    const players = makePlayers(['A', 'B']);
    players[0].isAlive = false;
    players[1].hasVoted = true;
    players[1].voteTarget = 'p1';
    const dealt = dealRoles(players, ['WEREWOLF', 'VILLAGER']);
    expect(dealt[0].isAlive).toBe(true);
    expect(dealt[1].hasVoted).toBe(false);
    expect(dealt[1].voteTarget).toBe(null);
  });
});

// ===== checkWinCondition =====
describe('checkWinCondition', () => {
  it('villagers win when no wolves alive', () => {
    const players = [
      { id: '1', role: 'VILLAGER', isAlive: true },
      { id: '2', role: 'WEREWOLF', isAlive: false },
    ];
    expect(checkWinCondition(players)).toBe('villagers');
  });

  it('wolves win when wolves >= villagers', () => {
    const players = [
      { id: '1', role: 'WEREWOLF', isAlive: true },
      { id: '2', role: 'VILLAGER', isAlive: true },
    ];
    expect(checkWinCondition(players)).toBe('wolves');
  });

  it('wolves win when wolves equal villagers (1v1)', () => {
    const players = [
      { id: '1', role: 'WEREWOLF', isAlive: true },
      { id: '2', role: 'SEER', isAlive: true },
    ];
    expect(checkWinCondition(players)).toBe('wolves');
  });

  it('no winner when game ongoing', () => {
    const players = [
      { id: '1', role: 'WEREWOLF', isAlive: true },
      { id: '2', role: 'VILLAGER', isAlive: true },
      { id: '3', role: 'VILLAGER', isAlive: true },
    ];
    expect(checkWinCondition(players)).toBe('');
  });

  it('returns villagers when all dead except villagers', () => {
    const players = [
      { id: '1', role: 'VILLAGER', isAlive: true },
      { id: '2', role: 'WEREWOLF', isAlive: false },
    ];
    expect(checkWinCondition(players)).toBe('villagers');
  });
});

// ===== tallyVotes =====
describe('tallyVotes', () => {
  it('returns correct mostVoted for single winner', () => {
    const players = [
      { id: 'p1', isAlive: true, voteTarget: 'p3' },
      { id: 'p2', isAlive: true, voteTarget: 'p3' },
      { id: 'p3', isAlive: true, voteTarget: null },
    ];
    const result = tallyVotes(players);
    expect(result.mostVoted).toBe('p3');
    expect(result.tally.p3).toBe(2);
    expect(result.isTie).toBe(false);
  });

  it('detects tie when multiple have same max votes', () => {
    const players = [
      { id: 'p1', isAlive: true, voteTarget: 'p2' },
      { id: 'p2', isAlive: true, voteTarget: 'p1' },
    ];
    const result = tallyVotes(players);
    expect(result.mostVoted).toBe(null);
    expect(result.isTie).toBe(true);
  });

  it('ignores dead players and null voteTarget', () => {
    const players = [
      { id: 'p1', isAlive: true, voteTarget: 'p3' },
      { id: 'p2', isAlive: false, voteTarget: 'p3' },
      { id: 'p3', isAlive: true, voteTarget: null },
    ];
    const result = tallyVotes(players);
    expect(result.tally.p3).toBe(1);
  });

  it('handles empty votes', () => {
    const players = [
      { id: 'p1', isAlive: true, voteTarget: null },
      { id: 'p2', isAlive: true, voteTarget: null },
    ];
    const result = tallyVotes(players);
    expect(Object.keys(result.tally)).toHaveLength(0);
    expect(result.mostVoted).toBe(null);
  });
});

// ===== addPublicLog =====
describe('addPublicLog', () => {
  it('prepends log and caps at 50', () => {
    let state = { status: 'night', nightCount: 1, dayCount: 0, publicLog: [] };
    for (let i = 0; i < 55; i++) {
      state = addPublicLog(state, `msg ${i}`);
    }
    expect(state.publicLog).toHaveLength(50);
    expect(state.publicLog[0].message).toBe('msg 54');
  });
});

// ===== archiveGame =====
describe('archiveGame', () => {
  it('archives players and winner to previousGame', () => {
    const state = {
      players: [{ id: '1', name: 'A', role: 'VILLAGER' }],
      winner: 'villagers',
      publicLog: [{ message: 'Win!' }],
    };
    const archived = archiveGame(state);
    expect(archived.previousGame).toBeDefined();
    expect(archived.previousGame.players).toHaveLength(1);
    expect(archived.previousGame.winner).toBe('villagers');
    expect(archived.previousGame.logs).toHaveLength(1);
  });

  it('returns state unchanged when null', () => {
    expect(archiveGame(null)).toBe(null);
  });
});

// ===== generatePlayerId =====
describe('generatePlayerId', () => {
  it('returns unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generatePlayerId());
    }
    expect(ids.size).toBe(100);
  });
});

// ===== Full Game Simulation =====
describe('Full game simulation', () => {
  function simNightBiteHeal(players, bittenId, healedId) {
    const actualDead = bittenId && bittenId !== healedId ? bittenId : null;
    return players.map(p => ({
      ...p,
      isAlive: p.id === actualDead ? false : p.isAlive,
    }));
  }

  it('night: wolf bites, doctor saves → no death', () => {
    const players = makePlayers(['W1', 'W2', 'D', 'V1'], ['WEREWOLF', 'WEREWOLF', 'DOCTOR', 'VILLAGER']);
    const after = simNightBiteHeal(players, 'p3', 'p3'); // bite D, heal D
    expect(after.every(p => p.isAlive)).toBe(true);
  });

  it('night: wolf bites, doctor saves other → victim dies', () => {
    const players = makePlayers(['W1', 'W2', 'D', 'V1'], ['WEREWOLF', 'WEREWOLF', 'DOCTOR', 'VILLAGER']);
    const after = simNightBiteHeal(players, 'p4', 'p2'); // bite V1, heal W2
    expect(after.find(p => p.id === 'p4').isAlive).toBe(false);
  });

  it('night: wolf bites, no heal → victim dies', () => {
    const players = makePlayers(['W1', 'V1'], ['WEREWOLF', 'VILLAGER']);
    const after = simNightBiteHeal(players, 'p2', null);
    expect(after.find(p => p.id === 'p2').isAlive).toBe(false);
  });

  it('Hunter shot: both Hunter and target die, villagers can win', () => {
    const players = [
      { id: 'w1', role: 'WEREWOLF', isAlive: true },
      { id: 'h', role: 'HUNTER', isAlive: true },
      { id: 'v1', role: 'VILLAGER', isAlive: true },
    ];
    // Hunter hanged, shoots wolf
    const after = players.map(p => {
      if (p.id === 'h' || p.id === 'w1') return { ...p, isAlive: false };
      return p;
    });
    expect(checkWinCondition(after)).toBe('villagers');
  });

  it('Hunter shot: Hunter shoots villager, wolves can win', () => {
    const players = [
      { id: 'w1', role: 'WEREWOLF', isAlive: true },
      { id: 'h', role: 'HUNTER', isAlive: false },
      { id: 'v1', role: 'VILLAGER', isAlive: false },
    ];
    // Hunter shot v1 before dying; w1 remains
    expect(checkWinCondition(players)).toBe('wolves');
  });

  it('simulate complete villagers win flow', () => {
    // 2 wolves, 1 seer, 3 villagers (6 total)
    const players = makePlayers(
      ['W1', 'W2', 'S', 'V1', 'V2', 'V3'],
      ['WEREWOLF', 'WEREWOLF', 'SEER', 'VILLAGER', 'VILLAGER', 'VILLAGER']
    );
    let state = { players, status: 'night', nightCount: 1 };

    // Night 1: wolves bite V1 (p4)
    state.players = simNightBiteHeal(state.players, 'p4', null);
    expect(checkWinCondition(state.players)).toBe(''); // 2 wolves vs 1 seer + 2 villagers

    // Day 1: vote W1 (p1)
    state.players = state.players.map(p =>
      p.id === 'p1' ? { ...p, voteTarget: null } : { ...p, voteTarget: 'p1' }
    );
    const vote1 = tallyVotes(state.players.filter(p => p.isAlive));
    expect(vote1.mostVoted).toBe('p1');
    state.players = state.players.map(p =>
      p.id === 'p1' ? { ...p, isAlive: false } : p
    );
    expect(checkWinCondition(state.players)).toBe(''); // 1 wolf vs 1 seer + 2 villagers

    // Night 2: wolves bite S (p3)
    state.players = simNightBiteHeal(state.players, 'p3', null);
    state.players = state.players.map(p => (p.id === 'p3' ? { ...p, isAlive: false } : p));
    expect(checkWinCondition(state.players)).toBe(''); // 1 wolf vs 2 villagers

    // Day 2: vote W2 (p2)
    state.players = state.players.map(p =>
      p.id === 'p2' ? { ...p, voteTarget: null } : { ...p, voteTarget: 'p2' }
    );
    state.players = state.players.map(p =>
      p.id === 'p2' ? { ...p, isAlive: false } : p
    );
    expect(checkWinCondition(state.players)).toBe('villagers');
  });

  it('ROLES have correct side for win check', () => {
    expect(ROLES.WEREWOLF.side).toBe('wolves');
    expect(ROLES.SEER.side).toBe('villagers');
    expect(ROLES.DOCTOR.side).toBe('villagers');
    expect(ROLES.HUNTER.side).toBe('villagers');
    expect(ROLES.VILLAGER.side).toBe('villagers');
  });

  it('night: doctor saves victim → no death (bite === heal)', () => {
    const players = makePlayers(['W', 'D', 'V'], ['WEREWOLF', 'DOCTOR', 'VILLAGER']);
    const after = simNightBiteHeal(players, 'p3', 'p3');
    expect(after.find(p => p.id === 'p3').isAlive).toBe(true);
  });

  it(' wolves win when last two are wolf and villager', () => {
    const players = [
      { id: 'w', role: 'WEREWOLF', isAlive: true },
      { id: 'v', role: 'VILLAGER', isAlive: true },
    ];
    expect(checkWinCondition(players)).toBe('wolves');
  });

  it('single wolf elimination gives villagers win', () => {
    const players = [
      { id: 'w', role: 'WEREWOLF', isAlive: false },
      { id: 'v1', role: 'VILLAGER', isAlive: true },
      { id: 'v2', role: 'VILLAGER', isAlive: true },
    ];
    expect(checkWinCondition(players)).toBe('villagers');
  });

  it('Hunter + shot target both die, correct win check', () => {
    // Hunter hanged, shoots wolf → villagers win
    const players = [
      { id: 'w', role: 'WEREWOLF', isAlive: false },
      { id: 'h', role: 'HUNTER', isAlive: false },
      { id: 'v', role: 'VILLAGER', isAlive: true },
    ];
    expect(checkWinCondition(players)).toBe('villagers');
  });
});
