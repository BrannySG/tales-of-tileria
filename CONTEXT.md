# Tales of Tileria — Context Glossary

The canonical vocabulary for this project. This file is a glossary only: no
implementation details, no specs, no decisions. When a term here conflicts with
language in the design docs, this file wins and the docs should be reconciled.

## Player & Cursor

- **Player** — A human participant. In this game the player has no walking
  avatar; they are perceived by the world as a divine force. The player's entire
  physical presence in the world is their Cursor.
- **Cursor** — The player's embodiment in the world (the thing with a nameplate
  and an equipped-tool ring in the mockup). "The player" and "the cursor" refer
  to the same actor from different angles: Player = the human/account, Cursor =
  their in-world presence.

## Damage & Targeting

- **Active damage** — Burst damage dealt by tapping/clicking an entity. The
  high-efficiency, hands-on way to deal damage. (Design docs also call this
  "tap damage".)
- **Passive damage** — Damage-over-time dealt automatically, in ticks, to the
  player's current Target. Its rate does not change based on whether the target
  was hovered or Locked.
- **Target** — The single entity currently receiving a player's Passive damage.
  A target is acquired by hovering over an entity, or pinned via Lock.
- **Lock** — A hands-free state, not a damage type. The player selects an entity
  and Locks it; Passive damage then continues ticking on that target with no
  further input (true idle). While Locked, the player may still tap for Active
  damage. Lock does not change Passive damage rate; it only removes the need to
  keep hovering.

## World

- **Level** — An authored place a player can be in (e.g. "The Grass Plains").
  This is the canonical term for a place. Created and saved by the Level Editor
  as a LevelDefinition. Retires the design-doc synonyms "Area" and "Zone".
- **Level instance** — A runtime, possibly-multiplayer copy of a Level, holding
  live state (entity HP, claims, respawn timers). Many instances can exist for
  one Level.

## Entities

- **Entity** — Any interactable thing placed in a Level (rock, tree, NPC,
  pickup, crafting station, shrine, quest object, enemy).
- **Entity definition** — The static, reusable content describing an entity
  type (display name, behaviors, max HP, respawn time, loot table, XP rewards).
  Authored once, referenced many times.
- **Entity instance** — A single placed entity in a Level/Level instance with
  its own live runtime state (current HP, claim owner, respawn timer).

## Economy

- **Currency** — A fungible, count-only measure the player accumulates and can
  spend (shown as the single coin total in the HUD). Distinct from Resources: a
  currency has no item identity beyond its amount.
- **Coins** — The prototype's single Currency.
- **Resource** — A gathered material item with its own identity (e.g. Wood,
  Stone), collected by damaging Resource entities and held in the Inventory.
  Resources are not Currency.
- **Inventory** — A player's collection of held items (Resources and other
  loot), keyed by item id with quantities.

## Tooling

- **Content Zoo** — A development testbed scene used to build and tune the feel
  of foundational game elements (rendering, hit feedback, particles, sound,
  animation) in isolation, before assembling real Levels. Not shipped to
  players.
- **Level Editor** — A development tool for placing Entity instances into a
  Level via drag-and-drop and assigning per-instance data (loot table, HP,
  respawn rate). Saves LevelDefinition files that the real game can load.
  Concerns *where* entities are placed (per-Level), not what a type looks like.
- **Entity Editor** — A development tool for tuning the global visual transform
  of an Entity definition (scale, rotation, anchor). Edits apply to every
  instance of that type across all Levels. Concerns *what a type looks like*
  (global), not where instances are placed. Complements the Level Editor.
