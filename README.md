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
Sound effects are optional and enabled by the Sound button. There is no original
soundtrack in this build. The game pauses when the tab loses focus.

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
pipe transitions, raccoon/fire suits, original music and plant fireballs remain
unfinished. Leaf blocks currently release mushrooms. Some layout decoration and
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
