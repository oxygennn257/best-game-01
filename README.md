# LANTERNFALL — defend the last lantern

A complete, original 2D arcade game for make.fun's best-game-01 bounty.
You are the last wisp-keeper of a dying lantern. Shades crawl out of the
dark to snuff its light. Shoot them down, gather the embers they drop, and
spend embers between waves on upgrades — but every ember you spend is score
you give up, and every ember you keep is light you did not restore.

## How to play

**Goal:** keep the lantern lit. Its light drains whenever a shade reaches
it and chews on it; at 0% the light goes out and the run ends. You have
3 hearts of your own — a shade that touches you costs one.

- **Move:** WASD or arrow keys
- **Aim:** mouse (the green line shows where your bolts go)
- **Shoot:** hold click or Space
- **Shop (between waves):** keys 1–4 or click a card
- **Pause:** P or Esc — **Restart:** R — **Mute:** M

**The trade-off is the game.** Killing a shade drops embers: each ember
is +5 score and +0.8 light when you pick it up, but the shop sells power
for embers — fire rate, extra bolts, move speed, or 35 light restored.
Spend too much and your score stalls; hoard too much and the lantern
starves. Kills in quick succession build a combo multiplier (up to x5).

**Waves:** each wave sends a bigger horde — fast skitters from wave 2,
armoured brutes from wave 3, splitters that burst into two shades from
wave 4, spitters that shoot back from wave 5, and a Warden mini-boss
every 5th wave. Clearing a wave pays a bonus and opens the shop.

**Enemies, at a glance:** purple spiky shades (the horde), pink darts
(fast, fragile), violet slabs (slow, 8 hits), green twin-lobes (split
when killed), orange diamonds (their mouth flares before they spit), and
the red crowned Warden. Your best score is saved in the browser.

Runs offline from static files: open `game/index.html` in desktop Chrome,
or serve `game/` with `node serve.ts`. No network requests, no libraries,
all art drawn in code, all sound synthesised with WebAudio.

Entry point: `main.ts` (Node 22) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json`.

License: MIT (see LICENSE).
