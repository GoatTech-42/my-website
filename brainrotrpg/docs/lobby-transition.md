# Lobby transition mapping (corrected per coordinator, 2026-10-31)

Source of truth: SHA-pinned group ledger (00-pvp_ledger-3a2cd95f.json /
01-pvp_ledger-65ad264d.txt). Coordinator correction relayed via Main 2026-10-31
11:05 PDT, verified against the ledger originals: counts agree exactly.

## Round separation is absolute

- Round 1 "hearts" (three-heart reset, reset msg phonemsg-01M688SF8HPCATPC4TTDDN88BN):
  3 ACTUAL rolls, each with a source message:
  - phonemsg-01M688TQ4E7R0WNMSBH4PP8KWE Kirk explosive stink-arrow, roll 14
  - phonemsg-01M688Z09MKMV8GM3ZBFQ6RZ7B Mercer pumpkin launcher splash, roll 20
  - phonemsg-01M6890E9MK97V48AH87QG2ZZE Roon cartoon shotgun low blow, roll 12 (KO)
  Totals: Roon 1 kill, Styoon 1 death; heart damage dealt Mercer 2 / Kirk 1 /
  Roon 1; taken Styoon 3 / Roon 1. These NEVER enter current-round counters.
- Round 2 "100 HP" (current, reset msg phonemsg-01M6893965H854C8QW591PJERE):
  10 resolved rolls + 2 non-roll events (Styoon respawn at 50 HP
  phonemsg-01M689RB4AWRRGKD0N0G0P4HR0, Ban joins at 38 HP
  phonemsg-01M68AMJ0K55BRBC8RZ8DP358A) recorded as notes, never invented rolls.
  Kills and deaths for the current round are ALL ZERO (real zeros, not unknown).

## Import mapping (when authorized)

- Character counters (new nullable stats): current round only.
  Kirk dealt 20 / taken 120 / healed 75; Mercer 130 / 85 / 25; Roon 95 / 55 / 0;
  Styoon 45 / 30 / 0; Ban 0 / 0 / 0 (real zeros: idle since joining).
  kills = 0, deaths = 0 for every player.
- Hearts round: represented separately - its 3 rolls as their own combat-log
  entries with source IDs, and the hearts totals in a rulings/lore record.
  Never merged into kills, deaths, damage or healing counters.
- Unknown stays unknown: pre-reset hits excluded (null), not zeroed.
- Map: schematic visuals must be labeled PROPOSED; only the 15-foot gap is
  fixed. No unapproved geometry imported as truth.
- Corrections preserved: Kirk "just kill me" forfeit reversed (no death
  counted, phonemsg-01M689RB4AWRRGKD0N0G0P4HR0 + phonemsg-01M689SVME04GDYGCAFKVBJPAR);
  Roon IDLE after food; Ban idle since joining; global pause, Mercer up next.
