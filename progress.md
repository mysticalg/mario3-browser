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
