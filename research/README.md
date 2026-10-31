# ROM level decoder research

These are reproducible terrain and object extracts for World 1-1, 1-2 and 1-3.
World 1-2/1-3 are **not selectable/playable courses in the browser build yet**.
The runtime remains v0.9.0. The next integration work is slope collision,
course-specific object spawning/behaviour, pipe destinations and progression.

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

Object IDs are read from the supplied ROM rather than substituted from source
symbols. In particular, World 1-2 has three C1 records where the available
Southbird source labels a different pipe-spawner ID. These records remain raw;
their matching runtime behaviour must be traced before course integration.

Research reference and credit: [Southbird's SMB3 disassembly](https://github.com/captainsouthbird/smb3),
PRG000 slope tables, PRG014 common generators, PRG015 plains and PRG016 hills.
Original game data and graphics copyright Nintendo.
