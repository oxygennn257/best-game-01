// Game state: the screen the player is on, the run's numbers, upgrades,
// and the persisted best score. Pure data + tiny helpers; the loop in
// main.js owns the transitions.

export const SCREEN = {
  TITLE: 'title',
  PLAYING: 'playing',
  SHOP: 'shop',
  PAUSED: 'paused',
  OVER: 'over',
};

export const BEST_KEY = 'lanternfall.best';

export function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // storage unavailable (private mode, sandbox): best score is session-only
  }
}

export function newRun() {
  return {
    screen: SCREEN.TITLE,
    prevScreen: SCREEN.PLAYING,
    score: 0,
    embers: 0,
    best: loadBest(),
    newBest: false,
    wave: 0,
    kills: 0,
    shotsFired: 0,
    timePlayed: 0,
    combo: 0,
    comboTimer: 0,
    light: 100, // the lantern's light; 0 means game over
    player: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    drops: [],
    particles: [],
    rings: [], // shockwave rings from kills, drawn by render.js
    floaters: [],
    shake: 0,
    waveState: 'idle', // idle | spawning | fighting | done
    spawnQueue: [],
    spawnTimer: 0,
    betweenTimer: 0,
    shopSelection: 0,
    stats: { wavesCleared: 0, embersCollected: 0 },
  };
}

export const UPGRADES = [
  {
    id: 'rapid', key: '1', name: 'Swift Wick',
    desc: 'Fire rate +25%',
    cost: (lvl) => 12 + lvl * 10,
    max: 4,
  },
  {
    id: 'spread', key: '2', name: 'Twin Flames',
    desc: '+1 bolt per shot',
    cost: (lvl) => 20 + lvl * 16,
    max: 3,
  },
  {
    id: 'boots', key: '3', name: 'Ember Boots',
    desc: 'Move speed +18%',
    cost: (lvl) => 10 + lvl * 8,
    max: 3,
  },
  {
    id: 'mend', key: '4', name: 'Mend the Lantern',
    desc: 'Restore 35 light',
    cost: () => 15,
    max: 99, // repeatable
  },
];

export function newUpgrades() {
  const u = {};
  for (const def of UPGRADES) u[def.id] = 0;
  return u;
}

export function upgradeCost(def, level) {
  return def.cost(level);
}
