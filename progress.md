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

0.4.0: User requested closer SMB3 play plus SFX and music. Added gradual acceleration
and ground friction, conserved airborne momentum, speed-dependent jump launch,
duck slides, held-jump stomp bounce, airborne stomp chains, shell carry/throw and
100-coin lives. Replaced numeric beeps with named layered sound effects and a new
original chiptune loop (not a transcription of the Nintendo soundtrack). Added
independent music toggle/M shortcut, hurry tempo, gesture unlock, pause/mute.
36 engine and 48 local browser checks pass, with offline rendering of all 13 SFX
checking nonzero RMS/no clipping, runtime scheduling, pause/mute and carry/throw.
Ran the unmodified skill Playwright client and inspected gameplay, carried shell,
desktop and mobile screenshots. No console errors. Remaining: original soundtrack,
bonus rooms, suits, world map, shell carrying poses, more exact NES physics.

0.4.1: Explicit request to use original audio from the user's ROM. Verified the
local ROM SHA256 matches the Downloads ZIP. Executed the original sound driver
at A000 (MMC3 28/29/31), capturing JSNES APU output at 44100 Hz. Generated original
music and all game cues, plus game-over/time-warning. Detected loop segments from
4DF driver state: normal intro 3.19458, end 28.75118 seconds; hurry intro 2.69535,
end 23.99179. Removed the composed sequence/oscillator implementation. PCM player
preserves pause position, resets on restart, supports independent music mute and
original tempo recording without pitch-shifting. Export script and provenance
are included; ROM is never committed. 36 engine / 52 browser checks pass locally.

0.5.0: User requested glow, motion blur, shadows and more FX. Added presentation-only
VisualEffects with pulsing item/block halos, projected/actor shadows, five-pose
world-space running trails, bounded deterministic particles for landings/skids/
coins/stomps/growth/finish and subtle vignette. Added persistent FX toggle and V,
reduced-motion trail suppression, reset/pause integration and text-state hooks.
36 existing engine tests / 59 browser checks pass. New checks cover visible pixel
differences, physics invariance, trails, particles, pause, persistence and reduced
motion. Ran unmodified skill client and inspected screenshots beyond start screen.

0.6.0: User requested raccoon suit/flight and imagegen parallax backgrounds.
Applied imagegen skill; generated a three-strip transparent pixel-art scenery atlas
and cropped it into sky/hills/forest. Removed strip divider pixels after visual
inspection. Cleared original sky and cloud tiles from the rendered scenery while
preserving original terrain/collisions. Added three parallax rates and vertical
sky camera. Decoded original raccoon frames PF00-02/03-05/07-0A/36-38/50 and leaf
from CHR; original ROM tail sound rendered with existing sound extraction tool.
Added progressive mushroom->leaf blocks, leaf float, raccoon damage stage, P-meter,
256-frame charged flight, tap-to-flap/flutter, tail enemies/blocks, ROM animations
and raccoon motion trails. Added explicit quick-start flight button and controls.
43 engine / 66 browser checks pass locally. Tested keyboard, simulated controller
and CDP touch flight, loop audio and old full-course protected demo. Ran unmodified
skill Playwright client and inspected raccoon, flight, generated landscape and
mobile screenshots. Remaining: bonus sky areas, other suits, exact NES timing.
