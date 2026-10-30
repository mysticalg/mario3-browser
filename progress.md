Original prompt: can you port it to browser; put it on github so i can test it there

2026-10-30: Port the corrected RISC OS prototype into a static browser game.
Preserve the supplied-ROM graphics, palette slot order, and corrected facing.
Use existing game/ROM art as the established visual design; no generated replacement art.
Publish only the browser app, not the NES ROM or RISC OS emulator/runtime.
Verify native-equivalent mechanics, browser controls, pause/restart, protected
preview, responsive touch UI, and the deployed GitHub Pages build.

Implemented a static browser port using the corrected ROM-derived atlas and level.
Exported backgrounds directly from CHR/metatile data for full RGB colour fidelity;
the native VIDC palette had merged sky and light-blue colours.
20 engine tests and 31 browser interaction checks pass locally, no console errors.
Inspected desktop menu/gameplay/Super Mario and mobile menu/gameplay screenshots.
Controller tests use the browser Gamepad API with a simulated standard pad; physical
hardware remains a user-side check. Touch tests send real browser touch events.
The protected demo reaches the card and restarts. Keyboard/touch/gamepad input takes
over from the demo. No new game art or image-generation workflow was needed.

Remaining inherited work: bonus areas, world map, extra suits, original music,
more faithful enemy behaviour/poses and visual overlap/shadow details.

0.3.1 polish: replaced the inherited 33 Hz/four-pixel scrolling with 60 Hz simulation
and interpolated, pixel-aligned presentation. Added jump buffering and ledge grace,
precise horizontal collision alignment, safe crouched growth and ducking, ROM skid/
death/duck/actual Super Mario jump frames, bitmap text, block bumps, coin pops and
brick debris. Fixed opposing-input conflicts, D-pad/stick conflicts, active-pad
stealing and missing touch controls/exit button in fullscreen. Added versioned
imports/assets to prevent a cached engine being mixed with a new renderer.
31 engine tests and 40 browser interaction checks pass locally. Protected preview
still completes the course; it now brakes before landing near pits after high jumps.
