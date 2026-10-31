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

0.6.1 continuing reverse engineering: inspected original shell-state setup and
object timer processing in PRG000. Shell wake timer is FF, decremented every other
frame normally, every fourth while held, then every frame below 60 hex. Shake
threshold/bit masks follow Object_SetShakeAwakeTimer / PRG000_CBB4. Implemented
wake-up towards Mario, release when held, restoration of body height, and ceiling
handling. Added moving-shell brick/question-block interactions (independent of
Mario size) and enemies bumped off blocks from below. Added 4 focused engine and
2 browser checks. Goal remains active: bonus rooms, additional level decoders and
other original systems are still incomplete.

0.6.1 validation: 47 engine tests and 68 local browser checks pass. Inspected
shell shake/brick-impact screenshots and the unmodified skill client gameplay
capture. Corrected opaque sky patches left by removed temporary blocks.

0.7.0 continued reverse engineering: traced PRG015 W101 header alternate pointer
BC93 in bank 15 to file 1FCAC (not the coincidentally duplicated stream in bank 13).
Decoded original 1-1 bonus stream: 12 coin "3", diamond rectangles, steps, ceiling
pipes, palette 5. E8/42/80 enters at bonus X136; E1/71/19 returns X2328 to pipe top
Y176. Recovered 45 omitted sky tiles from original main generator commands,
including high enterable pipe at X2256 / Y-96. Added sky collision/rendering and
independent area state, clipped pipe animations, score/suit/coin/clock persistence,
pause and main-start death. Added ROM underground normal/hurry recordings and
single-segment loop detection using repeating music-track counters. Self-contained
bonus/sky exporter added with exact pointer provenance. 53 engine / 79 browser
checks pass locally, including an input-driven raccoon approach/landing/entry and
keyboard, pad-Up, touch-Down and touch-Jump round trips. Goal remains active;
other levels, world map, other suits and remaining mechanics are incomplete.

0.8.0 continued reverse engineering: traced FireFlower handlers in PRG001 and
projectile slots/throw/update/world/enemy/poof logic in PRG007. Added Fire power,
flower-block progression (new logical kind 8), stationary flowers, input-edge
shooting, two slots, ROM integer speed/gravity/bounce, poofs, offscreen removal,
enemy fire-immunity and tumbling deaths. Added original Fire palette/frames and
flower/fireball/poof CHR assets. Direct ROM frame-page inspection caught and fixed
air throw page selection: PF34/35 are page 87, not 86. Added self-contained export
tool/provenance. Original firing and suit-loss sounds rendered. PRG000 USA damage
path confirms Fire/Raccoon->Super and immunity 71 hex; corrected sound/duration.
Quick-start dropdown keeps the original 1-1 leaf layout unchanged while exposing
Fire Mario. 64 engine / 88 browser checks pass, including real input-fired Goomba
kill, two-slot/edge controls, flower progression and all three input methods.
Goal remains active: more levels, map, enemy variants and other suits unfinished.

0.8.0 validation also covers native keyboard navigation of the suit selector.
Added a guard so its arrow keys no longer start the game. Screenshot review
confirmed grounded/airborne Fire palette, projectile and flower assets, and phone
menu layouts. Existing pipe/flight/audio/controller regressions remain green.

0.8.1 continued reverse engineering: decoded original W101 object list C537,
matched 14 enemies to existing coordinates, retained end card and full provenance.
Restored red identity/palette for both 6D Koopas. Read PRG004 RedTroopa ledge
routine and GroundTroop_XVel; added half-pixel normal walking and red ledge
turnaround while leaving kicked shells free to fall. Consolidated area enemy
creation so metadata persists across bonus visits. Added self-contained exporter.
67 engine tests / 89 browser checks pass locally. Inspected red Koopa rendering
and unmodified skill client gameplay screenshot. Remaining: firing plant variants,
full level decoder integration, hills slope physics, more levels and world map.

0.9.0 continued reverse engineering: traced PRG005 Piranha init/phase routines
and SpitFire; PRG007 SObj_Fireball confirms no gravity for hostile plant fire.
Restored A6/A0/A4 variants, +8 centering, 33/25 rise, 96/48 phase waits, hidden
proximity gate, timer40 firing and 11/16 or 14/16 horizontal, 11/16 or 5/16
vertical aiming. Added independent four hostile slots, damage/invulnerability,
pause/transition/death cleanup and text snapshots. Exported CHR79 plant frames.
Source review caught green stems even on red plants and independent head V flip;
corrected both. Auto preview needed active countersteer before pits after changed
plant timing, because neutral airborne input preserves momentum. 73 engine and
92 browser checks pass locally, including normal-update firing and damage.
Inspected Venus shot, green variants and unmodified skill-client gameplay captures.
Remaining: full terrain decoder integration, hill slopes, additional levels/map,
other enemy families and game mechanics. Goal remains active.

Terrain decoder research: promoted the original-6502 extraction experiment into
reusable tools/decode-rom-levels.mjs, with revision gate, bounded execution,
course presets, raw object IDs, tile-RAM hashes and rendering metadata. Extracted
1-1/1-2/1-3 (6480 bytes each) into research/levels, plus original-art PNG previews.
Recovered 21 original slope profiles, tile mappings and player velocity effects
from PRG000. Added repeat-decoding verifier and independent comparison with the
private original-ROM runtime state: 6424 exact bytes and56 random decorative
cloud differences, zero other terrain differences. Source enum mismatch in1-2
(C1 actual versus BC source) is preserved explicitly, not guessed. Six decoder
checks plus73 gameplay checks pass (79 total). Viewed1-1 full map,1-2 hills start
and1-3 start previews. Runtime remains0.9.0; these new courses are research data,
not exposed as playable until slope collision/objects/pipes are implemented.
Goal remains active. Next: integrate original slope height profiles and verify
movement against original-ROM trajectories before enabling1-2.
