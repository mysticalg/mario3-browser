# ROM level decoder research

These are reproducible terrain and object extracts for World 1-1, 1-2 and 1-3.
The v0.10.0 browser build now plays converted versions of World1-2/1-3, with
sampled slope collision and course progression. The new courses still need
several enemy variants, secret rooms and pipe destinations. These research JSON
files retain original coordinates; runtime copies live in assets/courses.

Run from the repository after `npm ci` (rendering additionally needs Pillow):

```
node tools/decode-rom-levels.mjs your-rom.nes research/levels
python tools/render-decoded-levels.py your-rom.nes FCEUX.pal research/levels
node tools/verify-rom-levels.mjs your-rom.nes research/levels
```

The decoder accepts only the supplied USA ROM SHA-256, stated in each JSON.
It executes the original 6502 level loader at A408 under JSNES, mapping the
course's generator/data bank at A000, common bank14 at C000, bank30 at8000 and
fixed bank31 at E000. PPU IRQs are disabled and a bounded fake RTS return detects
completion. Nothing from this extraction emulator is loaded by the browser game.
The ROM itself and private emulator save states are not in the repository.

Each JSON contains all 6,480 tile bytes rearranged from original 15-screen RAM
(432 bytes per screen) into a 240x27 row-major map. Original coordinates are
preserved; the existing browser 1-1 viewport subtracts 208 pixels from Y. Header,
object stream offsets, instruction count and original tile-RAM fingerprint make
exports traceable. Full PNGs show all 27 rows; `*-start.png` shows the first three
screens at the normal starting height. They contain terrain only, not actors.

Hills data also contains the original 21 slope profiles, tile-to-shape mapping
and player slope velocity effects. Profile low/high nibbles encode floor/ceiling
height. Several shape IDs have explicit wall/ground/ceiling semantics even when
the profile is all zero; future collision code must retain those distinctions.

The initializer uses zero RNG state for deterministic extraction. The committed
verification report additionally compares World 1-1 against a private save state
from the **fully running original ROM**: 6,424/6,480 bytes match exactly; all 56
remaining differences are decorative random clouds (tiles10/11/12 versus sky80).
There are zero other terrain differences. Supply that compatible save state as
the optional final argument to `verify-rom-levels.mjs` to repeat the comparison.
Without it, the verifier repeats decoding twice and compares the saved exports.
Only 1-1 currently has this independent full-runtime comparison; 1-2/1-3 were
reproduced through the original loader and rendered for visual inspection.

Object IDs are read from the supplied ROM. Correction to the initial research:
the three World1-2 C1 records match the Southbird definition exactly:
`OBJ_CFIRE_GOOMBAPIPE_R = $BC + CFIRE_GOOMBAPIPE_R - 1`, where the cannon ID is6.
The early enum scanner mistakenly stopped at BC and ignored the arithmetic.
The v0.11.0 runtime now implements these spawners. Their isolated original-ROM
trace is in `goomba-pipe-trace.json`; reproduce it with:

```
node tools/trace-rom-goomba-pipes.mjs your-rom.nes research/goomba-pipe-trace.json
```

This calls the original PRG007 routine at BD15 for both player sides and four
counter phases. All8 traces return normally. They prove right-side gating,
112-frame reload, three outputs followed by one skipped cycle, exact spawn
coordinates and40-frame emergence. The initial96-frame timer and half-pixel
horizontal movement come from PRG005 spawn setup and PRG004 ground-troop logic.

Research reference and credit: [Southbird's SMB3 disassembly](https://github.com/captainsouthbird/smb3),
PRG000 slope tables, PRG014 common generators, PRG015 plains and PRG016 hills.
Original game data and graphics copyright Nintendo.

Boomerang brother research: `boomerang-traces.json` contains167 successive
original PRG007 B8AB projectile states and18 original PRG004 A499 patrol samples
across180 ticks. The patrol fixture uses the decoded1-3 TileRAM; both fixtures
use explicit zeroed initial counters and fixed actor/player positions. Reproduce:

```
node tools/trace-rom-bro.mjs your-rom.nes research/boomerang-traces.json
```

The pure4.4 fixed-point module is tested against every captured flight position,
fraction, velocity, timer and phase through the original catch frame166. These
isolated fixtures verify the named routines; they do not establish identical RNG
history or cycle-exact behaviour for an entire played campaign.
