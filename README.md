# Mario 3 · Browser demo

**[Play on GitHub Pages](https://mysticalg.github.io/mario3-browser/)**

A browser port of the native RISC OS prototype, using reconstructed World 1-1
geometry and original ROM-derived artwork. Runs as a static Canvas/JavaScript app.
No emulator, full NES ROM, account, or server-side service is required to play.

### 0.3.1 — movement and presentation update

- 60 Hz gameplay with interpolated presentation and smooth camera tracking.
- A short jump buffer and ledge grace period, without holding jump causing repeated jumps.
- Collision alignment at walls, safe mushroom growth under low ceilings, and ducking.
- Original ROM skid, duck, death and Super Mario jump poses.
- Crisp bitmap HUD text, bouncing blocks, coin pops and brick fragments.
- D-pad priority over stick drift, stable active-controller selection, and touch controls in fullscreen.
- Versioned assets/modules so returning players get a consistent update.

## Controls

| Action | Keyboard | Standard gamepad | Touch |
| --- | --- | --- | --- |
| Move | Arrows or Z / X | D-pad or left stick | Left / right |
| Jump | Space or Up | A / bottom face button | JUMP |
| Run | Shift | X or B / left or right face button | RUN |
| Duck (Super Mario) | Down or S | D-pad / stick down | Down arrow |
| Pause / resume | P | Start / Menu | Pause button |
| Restart | R | Select / View | Restart button |
| Fullscreen | F; Esc exits | — | Fullscreen button |

Connect your controller, focus the game tab and press a button. The connection
indicator updates when the browser exposes the pad. Xbox, PlayStation and other
standard browser-mapped controllers use the same logical layout; labels differ.
Controllers with custom/non-standard mappings may need configuration in the OS.

The **protected demo** ignores enemy damage and runs automatically. Move or jump
to take manual control. Manual play uses normal damage, lives and respawning.
Sound starts after Play. The Sound button mutes all audio; the Music button or M
toggles music separately. The music and effects now come from the supplied ROM, rendered through its
original sound driver and NES audio emulation. The game pauses when the tab loses focus.

## Included

- Corrected Mario facing and original ROM palette slot order.
- Full browser RGB colours from the FCEUX reference palette, without VIDC colour
  quantization. Background tiles are decoded directly to avoid merging NES colours.
- World 1-1 geometry, clouds, bushes, coloured platforms, blocks, pipes and pits.
- Walking/running and variable-height jumping; solid and one-way platform collisions.
- Coins, question blocks, mushrooms, Super Mario, brick breaking and used blocks.
- Goombas, hopping enemies, Koopas/shells and pipe-plant contact hazards.
- Score, lives, timer, pause, restart and the cycling card goal.
- Keyboard, multi-touch controls and the browser Gamepad API.

This is a playable development prototype, **not the complete original game**.
Physics and enemy behaviour are native reconstructions. The world map, bonus
additional pipe transitions, tanooki/frog/hammer suits and plant fireballs remain
unfinished. Power blocks release mushrooms for small Mario and leaves for Super Mario. Some layout decoration and
enemy poses differ from the original.

## Run locally

With Node.js installed:

```sh
npm start
```

Open **http://127.0.0.1:4173**. Alternatively use any static web server. Opening
`index.html` directly with `file://` is not supported because the app loads modules
and level data. GitHub Pages serves the repository root; `.nojekyll` is included.

## Tests

```sh
npm ci
npm test
npx playwright install chromium
# In another terminal: npm start
npm run test:browser
```

The engine suite checks gameplay mechanics, original-level completion and controller
mapping/deadzone/edge behaviour. The browser suite checks actual keyboard, audio
toggle, pause/restart, gamepad input, disconnection, power-ups, death/respawn, protected
course completion, mobile layout and touch input, with screenshots and console checks.

Controller input has been exercised with a standard-mapped simulated Gamepad API
device. Physical hardware still needs checking on your browser/OS/controller setup.
No analytics, remote game services, or user accounts are used.

## Structure

- `engine.js`: deterministic 60 Hz game simulation, refined from the RISC OS prototype.
- `input.js`: controller mapping, deadzone and button-edge handling.
- `main.js`: Canvas rendering, keyboard/touch input, menus and generated sound cues.
- `pixel-font.js`: crisp bitmap HUD lettering.
- `assets/`: decoded art and reconstructed level data, with no full ROM/program code.
- `tests/`: engine and browser interaction checks.

For automated inspection, `window.render_game_to_text()` returns game state and
`window.advanceTime(ms)` steps deterministic simulation time. `?test=1` additionally
exposes test fixtures; no fixture access is needed for normal play.

## Credits and rights

Super Mario Bros. 3, its characters and original artwork belong to Nintendo.
This is an unofficial prototype, with no affiliation or endorsement.

- ROM format/graphics/level research: [Southbird’s SMB3 disassembly](https://github.com/captainsouthbird/smb3), [Super Mario 3Mix](https://www.sonicepoch.com/sm3mix/).
- NES RGB reference: [FCEUX default palette](https://fceux.com/web/help/PaletteOptions.html).
- The original supplied ROM and the RISC OS emulator/runtime are not included.

The MIT license in `LICENSE` applies only to the newly written browser code;
it grants no rights to Nintendo artwork, characters or other original game material.

## 0.4.0 gameplay and audio

Momentum now persists in the air, ground friction is gradual, running increases
jump height, and ducking brakes into a slide. Hold Jump for a higher enemy bounce;
consecutive airborne stomps build a score combo. Hold Run against a stationary
shell to carry it, then release Run to throw. Every 100 coins grants a life.

Added two pulse voices, triangle bass and noise percussion for looping music,
plus distinct jump, coin, bump, brick, stomp, kick, emergence, growth, extra-life,
shrink, death and course-clear effects. Music speeds up below 100 seconds.
Audio unlocks with a player gesture and stops on pause, blur and mute.

Validation: 36 engine checks and 48 browser checks, including rendered audio
waveforms, music scheduling/mute/pause, shell carry/throw, keyboard, simulated
standard controller, mobile touch and fullscreen. Physical controller hardware
and speaker playback remain user-side checks.

## 0.4.1 original ROM audio

Replaced the 0.4.0 composed tune and synthesized effects with PCM rendered from
the supplied SMB3 USA Rev 1 ROM. Runs the original sound engine at $A000 with
MMC3 banks 28/29/31 in JSNES 2.1.0. Includes original overworld music, ROM-tempo
hurry music, jump, coin, bump, brick, stomp, shell kick, mushroom emergence,
growth, 1-up, shrink, death, game-over, time-warning and course-clear audio.
Small and Super Mario use the same original jump effect, as the ROM driver does.
Intro/loop boundaries are detected from the driver's music-segment transitions.
Pause/resume retains position; restart replays the intro. M toggles music alone.

`assets/audio/provenance.json` records the input ROM hash, queue requests, output
hashes and loop boundaries. No ROM or emulator runtime is shipped to players.
To regenerate locally: `node tools/render-rom-audio.mjs path/to/your-rom.nes`.
Audio and graphics remain Nintendo content and are excluded from the MIT code
license. Sound-driver reference: Southbird's SMB3 disassembly (already linked
above); emulator: https://github.com/bfirsh/jsnes, Apache-2.0.

Validated 36 engine checks and 52 browser checks, including waveform rendering,
original PCM buffer playback, normal/hurry tracks, loop boundaries and pause
position. Hardware speaker listening remains a user-side check.

## 0.5.0 visual effects

FX is on by default. Click **FX on/off** below the game, or press **V**, to switch
between enhanced effects and the crisp original presentation. The choice persists
in this browser. Includes collectible/block/mushroom/card glow, ground-projected
shadows, soft sprite shadows, world-space running afterimages, landing/skid dust,
coin/stomp/power-up/finish particles and subtle edge shading. The HUD stays crisp.
Trails respect reduced-motion preferences. Effects run on the simulation clock,
freeze when paused, are bounded to five trail poses and 100 particles, and do not
modify collisions, controls, gameplay timing or original ROM audio.

Validation: 36 engine checks, 59 browser checks, plus the skill Playwright client.
Inspected effects-on/off, running, glowing power-ups, particles and phone layouts.

## 0.6.0 raccoon flight and generated parallax

Collect a leaf from a power-up block while Super Mario to gain raccoon power.
Run at full speed to charge the seven-step P-meter. Jump with a full meter and
keep tapping Jump to flap during a limited 256-frame flight window. Jump taps
without charged flight slow a fall. Tap Run for a tail swipe: it hits nearby
enemies and adjacent bricks/question blocks. Damage removes raccoon power first,
then Super Mario. Ducking and shell carrying still work. A vertical camera follows
flight above the original level, with a bounded sky ceiling.

**Try raccoon flight** starts airborne with raccoon power and a charged meter for
quick testing. Normal Play starts small and keeps ordinary power-up progression.
Keyboard: Space/Up flaps, Shift runs/swipes. Gamepad: A flaps, X/B runs/swipes.
Touch: JUMP flaps, RUN runs/swipes. The original ROM tail sound is included.

Raccoon walking, jump, flight, flutter, tail-turn and duck frames, and the leaf,
are decoded from the supplied ROM. Sky/clouds, distant hills and forest scenery
are generated with imagegen, split into alpha layers and scrolled at 0.08, 0.22
and 0.45 times the world camera speed. Original terrain/collision geometry stays
at full speed. The near layers move out of view as the camera climbs. Background
asset provenance is recorded in `assets/background-provenance.json`.

Validation: 43 engine checks and 66 browser checks, including charged takeoff,
flight expiry, flutter, tail/enemy/block interaction, damage, sky camera, keyboard,
simulated pad and real browser touch input. The skill Playwright client was run
through raccoon gameplay and screenshots were inspected. Flight is a native
reconstruction and is not cycle-exact NES gameplay.

## 0.6.1 shell lifecycle and block interactions

Shelled Koopas shake and wake up, including while carried. The timer cadence and
shake masks follow PRG000 of the original disassembly: FF initial timer, half-rate
countdown on the ground, quarter-rate while held, full-rate below 60 hex. Waking
restores Koopa height and faces Mario. Shells now break bricks and hit question
blocks independently of Mario's size; hitting blocks from below also defeats an
enemy standing on top. This continues the reverse-engineering work; bonus areas
and other original gameplay systems remain incomplete.

## 0.7.0 original World 1-1 bonus room

The hidden high pipe now reaches the original blue-block bonus room with the big
coin "3". Fly above the main course near the end, land on the high pipe and hold
Down. Jump up into the ceiling pipe beyond the room's steps to return to the
ROM-linked main-level exit. D-pad Up also enters a ceiling pipe; touch Jump works.

This is decoded from the supplied ROM's actual alternate-area pointer: main
header at file 1FB92, alternate CPU address BC93 in PRG bank 15, bonus stream at
file 1FCAC. The 12 coins, diamond-block rectangles, stairs, ceiling pipes and
palette 5 come from the original room records. The E8/42/80 and E1/71/19 junctions
lead to the bonus entrance and return pipe. The exporter is self-contained:
`python tools/export-w101-bonus.py your-rom.nes FCEUX.pal` (Pillow required).

Restored 45 terrain tiles above the old viewport, including the high entrance
pipe. Independent area state preserves collected coins and changed main terrain;
suits, score and lives survive the trip. Pipe movement freezes the game timer and
pauses normally. Death still respawns at the main course start. Area-specific
original underground music (and its hurry version) is rendered with the existing
ROM sound-driver tool. For its single-segment loop, the exporter detects repeating
music-track offsets/rest counters rather than relying only on segment index.

53 engine checks and 79 browser checks pass locally, including a controller that
flies to the high pipe with ordinary movement inputs, full return trip, coin
collection/persistence, suit preservation, pause and keyboard/pad/touch pipe
controls. This implements one original bonus area; other levels and original
systems remain unfinished.

## 0.8.0 Fire Mario and original weapon behaviour

Choose **Fire Mario** in the quick-start selector and click **Try suit**. Tap Run
(Shift on keyboard, X/B on a controller, RUN on touch) to shoot. Holding Run does
not auto-fire. Ducking and carrying prevent firing; two projectile slots are
available, including impact poofs. World 1-1 retains its original leaf blocks;
flower blocks are supported by the engine for later level decoders rather than
substituted into this course. Ordinary loose flowers grow small Mario first, and
upgrade Super Mario to Fire Mario. Leaves replace fire power with raccoon power.

Source: PRG007 PlayerProj_ThrowWeapon / PlayerProjs_UpdateAndDraw / fireball world
and enemy hit routines: integer X velocity +/-3, initial Y velocity +3, gravity
increments every fourth update up to +4, bounce Y velocity -3, 11-tick throwing
animation, two slots and 13-tick impact poofs. Collision code remains a native
reconstruction, including solid and one-way surfaces, fire-immunity support,
enemy knockback and off-screen disposal. Projectiles freeze on pause and clear
on death/area transitions.

Fire palette 27/36/16, throwing frames, flower, fireball rotation and impact
patterns are decoded from the ROM. `assets/fire-provenance.json` records offsets.
`python tools/export-fire-assets.py your-rom.nes FCEUX.pal` regenerates them from
the supplied ROM and base atlas. The frame page-offset table is read directly;
air throws use CHR page 87. Added the original firing sound and corrected the
USA power-loss sound and 71-hex immunity duration for Fire/Raccoon Mario. The USA
ROM downgrades these powers to Super Mario before ordinary shrinking.

Validation: 64 engine checks and 88 browser checks. Covers flower progression,
input edges/two slots, integer projectile physics, bouncing/wall poofs, enemy
hits/immunity, carried/duck restrictions, pause, damage/replacement, normal-input
Goomba defeat, airborne animation and keyboard/gamepad/touch firing. Raccoon
flight and original bonus-room round trips still pass. Other levels and systems
remain unfinished; this is not the complete NES game.

## 0.8.1 ROM enemy identities and red Koopas

Decoded all 15 World 1-1 object records at ROM file offset C537 (header,
14 enemies, end card and terminator), retaining their raw IDs and coordinates.
The two 6D records now select red Koopas with a red shell palette. PRG004
ObjNorm_RedTroopa supplies the half-pixel walking speed and ledge turnaround;
green ground Koopas also use the original normal half-pixel speed. Shell colour
survives stomping, carrying, kicking and waking. Exporter:
`python tools/export-w101-enemies.py your-rom.nes FCEUX.pal`.
Validation: 67 engine tests, 89 browser checks, inspected red Koopa screenshot
and unmodified skill client raccoon gameplay. Enemy variants, plant attacks,
additional levels, slopes and world map still need reconstruction.

## 0.9.0 original Piranha variants and aimed fire

World 1-1 object IDs A6/A0/A4 now select the red Venus Fire Trap, plain green
Piranha and green fire-spitter. PRG005 supplies their centered pipe position,
33/25 pixel rise heights, one-pixel movement, 96/48 tick phase timers,
proximity-gated emergence and World 1 firing at timer 28 hex. Hostile fire uses
four separate slots and the original discrete close/far aiming velocities;
it travels straight, damages Mario, respects immunity and freezes on pause.
Fire Mario can defeat an exposed plant while its existing projectile continues.
Original CHR page 79 supplies distinct animated heads and green stems. The
head alone flips vertically to aim. Export with
`python tools/export-plant-assets.py your-rom.nes FCEUX.pal`.

The protected demo now counter-steers to brake airborne momentum before a pit
rather than merely releasing Right. Validation: 73 engine tests, 92 browser
checks, original skill client gameplay and inspected plant/fireball screenshots.
This remains a reconstruction; additional levels, slopes, map and other enemy
families are still unfinished.
