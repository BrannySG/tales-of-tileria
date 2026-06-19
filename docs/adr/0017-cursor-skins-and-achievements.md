# ADR 0017 — Cursor skins as sim-authoritative cosmetics, unlocked by Achievements

- Status: Accepted
- Date: 2026-06-19

## Context

The game shipped a single hardcoded cursor arrow (`T_Cursor_Cracked.png`) used
everywhere a Cursor is drawn: the local player's in-world Cursor, the HUD avatar,
and other players' Networked cursors. New cursor art arrived (Wooden, Stone,
Handdrawn, Council) and we want two things:

1. **Authoring** — let a level author dress a Cursor-being Entity (Council level)
   with a chosen cursor look per placed instance.
2. **Player cosmetic** — let players unlock and equip a Cursor skin, see it on
   their HUD avatar and in-world Cursor, and have other players see it too.

The unlock conditions are skill milestones ("Reach Level 10 Woodcutting",
"…Mining"). The existing Quest system is a linear, manually-claimed chain shown
in the Quest Tracker with no skill-level objective kind — a poor fit for passive,
profile-surfaced milestones.

## Decision

### Cursor skins are sim-authoritative Player state

`Player` gains `unlockedCursorSkins: string[]` and `cursorSkinId: string` (see
CONTEXT.md: Cursor skin). Equipping is a `cosmetic.equip` command the sim
validates (must be an owned, player-equippable skin). The equip emits a
**world-scoped** `cosmetic.equipped` event so every client re-skins that player's
cursor; unlocks emit a **player-scoped** `cosmetic.unlocked`. This reuses the
existing event-scope fan-out (ADR-0014/0016) with no server changes.

State persists in the **client `localStorage` save** and re-seeds on join, exactly
like skills/tools (server-side persistence stays deferred, see ADR-0016).

### One shared Cursor skin registry

A single `CURSOR_SKINS` catalogue (`packages/shared/src/content/cursorSkins.ts`)
maps a skinId to a label, an abstract `textureId`, and how it unlocks. Both the
player cosmetic gallery and the Level Editor's per-instance skin dropdown read it.
The Council skin is marked `playerEquippable: false` — authoring-only art, never a
player cosmetic. Per-instance entity skins ride on `EntityOverrides.skinId` and
swap the texture in `resolveArt(def, skinId)`; transforms still come from the
definition/overlay (ADR-0004).

### Skill milestones are Achievements, not Quests

A lightweight `Achievement` (`packages/shared/src/content/achievements.ts`) pairs
a condition (`reachSkillLevel`) with a reward (unlock a Cursor skin). The sim
evaluates them on `skill.leveledUp` and on join (a silent heal pass for carried
snapshots that already qualify). Achievements are passive (no Claim) and surface
in the Profile, keeping the onboarding Quest chain clean. Client completion is
derived from authoritative Skill levels, so no separate completion state is stored.

### Profile modal + client-local New indicators

A Profile modal (opened from the HUD avatar) presents identity + stats, the skin
gallery (equip / locked silhouettes), and Achievements. Red "New" indicators are a
**per-device read-receipt** (`localStorage`, not Player state): a skin/achievement
is "new" until the relevant Profile tab is viewed. Unlocks earned on another
device still show a dot there, because the dot derives from unlocked-vs-seen.

## Consequences

- Cursors are no longer hardcoded: `CursorView`, `RemoteCursorView`, and the HUD
  avatar all resolve the equipped skin's texture; `cursorSkinTextureId` falls back
  to the Default skin for unknown/missing ids.
- The Level Editor Inspector shows a skin dropdown only for `cursorBeing`
  instances and re-spawns the preview sprite on change.
- Adding a new cursor skin = one registry entry + one manifest texture; adding a
  new skill-milestone unlock = one achievement entry. No protocol changes.
- "New" read-receipts can differ per browser and reset if storage is cleared —
  acceptable for a cosmetic cue; would follow the account once server-side
  persistence (ADR-0016 deferred seam) lands.
- The achievement condition kind is currently only `reachSkillLevel`; the shape is
  kept extensible for future conditions/rewards.
