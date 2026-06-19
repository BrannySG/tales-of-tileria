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
- **God Cursor** — Emphatic synonym for the Cursor, naming the fantasy: the
  player is a divine force whose only physical presence is the cursor. Used when
  the divine framing matters (hover ring, click impact, nameplate). Same actor as
  the Cursor.
- **Divine name** — The name the player gives themselves at the shrine
  Dedication. Sim-authoritative (a `player.setName` command sets it; it is the
  Player's `displayName`) and persisted on the client, so the shrine label,
  cursor nameplate, NPC lines, and welcome message all read it.

## Divine Powers

- **Divine power** — A removable, player-scoped supernatural capability,
  authoritative on the Player and portable across Levels until revoked by a
  `player.setDivinePower` command. Smite is the first; the structure is kept
  extensible for later powers. Losing and regaining divine power is the game's
  long-term progression spine.
- **Smite** — A temporary Divine power active during the divine intro: every
  third consecutive Active tap on the **same** target lands as a Smite — a single
  Active hit multiplied (not an extra swing), with a dramatic flash, oversized
  damage number, and impact sprite. The per-target counter is transient World
  state; the unlock flag rides the Player snapshot. Granted at the intro start,
  revoked by the Council at Banishment.
- **Banishment** — The arc beat in which the Council of Clickers strips the
  player's Divine power (Smite) and casts them into the mortal realm. It removes
  intro-only power **only** — Owned tools, Skills, Inventory, Divine name, and
  Quests are all retained — and is enacted as a real sim command, so the carried
  snapshot inherits the change.
- **Council of Clickers** — A court of celestial Cursor-beings who judge the
  player for meddling with mortals and enact the Banishment. Authored as a real
  Level (`council_01`) of Cursor-being Entities, scripted by a Director.

## Damage & Targeting

- **Active damage** — Burst damage dealt by tapping/clicking an entity. The
  high-efficiency, hands-on way to deal damage. (Design docs also call this
  "tap damage".)
- **Passive damage** — Damage-over-time dealt automatically, in ticks, to the
  player's current Target. Its rate does not change based on whether the target
  was hovered or Locked. The per-tick *amount* is a player-owned progression
  stat (`Player.passiveDamage`) that new players start at `0` (passive is off
  until earned via an upgrade); the tick *cadence* is the Level's
  `CombatConfig.passiveTickSeconds`. Set via the `player.setPassiveDamage`
  command, which emits `passiveDamageChanged`.
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
  one Level. A Player's personal state (Divine name, Owned tools, Skills,
  Inventory, Quests) is **portable across Level instances**: a snapshot can seed a
  new instance, so progress survives a Level swap (e.g. tutorial → Shared zone).
- **Shared zone** — The canonical networked open world (`bigworld_01`, "The Open
  World") the player is dropped into after the Council, and the default
  destination for returning players in Game mode. The player's first time
  genuinely existing around other players: real, server-authoritative
  multiplayer (see ADR-0016), not faked presence. The retired `mortal_realm_01`
  was its single-player predecessor; its lived-in content is being folded into
  `bigworld_01`.
- **Multiplayer Level** — A Level that declares a `multiplayer` config block
  (`maxPlayers`, optional `pvp`, optional `interactionDefault`). Present = a
  networked, shared space; absent = single-player (the tutorial, Council,
  cutscenes). Most future Levels will be multiplayer (see ADR-0016).
- **Instance (server)** — A Durable Object (`InstanceDO`) that owns the
  authoritative `World` for one Level instance, ticks it server-side, and fans
  events to its connected players. Holds up to `maxPlayers` (5 in the open
  world); state is ephemeral today (resets when empty).
- **Router** — A per-Level Durable Object (`RouterDO`) that assigns a joining
  player to an Instance density-first (fill the least-full non-full Instance;
  roll into a fresh one only when all are full).
- **Presence** — The set of players currently in an Instance. Joins/leaves are
  broadcast (`presence.joined` / `presence.left`) so every client can spawn or
  remove the corresponding Networked cursor.
- **Networked cursor** — Another player's cursor rendered locally: an arrow with
  a nametag, eased toward its broadcast world position, with a tool/lock ring and
  a pulse cue when that player lands a hit.

## Entities

- **Entity** — Any interactable thing placed in a Level (rock, tree, NPC,
  pickup, crafting station, shrine, quest object, enemy).
- **Entity definition** — The static, reusable content describing an entity
  type (display name, behaviors, max HP, respawn time, loot table, XP rewards).
  Authored once, referenced many times.
- **Entity instance** — A single placed entity in a Level/Level instance with
  its own live runtime state (current HP, claim owner, respawn timer).
- **Cursor-being** — An Entity kind for a celestial or scripted cursor (Council
  members, ambient crowd cursors): non-damageable and non-reactive, a scriptable
  speaker a Director addresses by instance id. Distinct from a mortal System NPC,
  and distinct from a **Networked cursor** (a real other player): ambient
  Cursor-beings are authored set-dressing, not live players.
- **Ancient Tree** — An imposing, effectively unbreakable Resource that gates the
  path beyond the tutorial. Striking it (especially with Smite) triggers the
  Council of Clickers cutscene. It is never actually depleted and remains a
  long-term aspirational gate ("you are not strong enough yet").
- **Shrine** — A persistent Entity that receives crafted results: a completed
  Crafting job places its Offering on the Shrine to be claimed. Authored locked,
  enabled (undedicated) by a Quest reward, then Dedicated by the player.
- **Dedication** — The presentational act of naming a Shrine. When the player
  sets their Divine name at the enabled Shrine, the client renders it as "Shrine
  of [name]". Dedication is the beat at which Crafting unlocks.

## Economy

- **Currency** — A fungible, count-only measure the player accumulates and can
  spend (shown as the single Gold total in the HUD). Distinct from Resources: a
  currency has no item identity beyond its amount.
- **Gold** — The prototype's single Currency. Retires the earlier synonym
  "Coins".
- **Resource** — A gathered material item with its own identity (e.g. Wood,
  Stone), collected by damaging Resource entities and held in the Inventory.
  Resources are not Currency.
- **Inventory** — A player's collection of held items (Resources and other
  loot), keyed by item id with quantities.
- **Item** — A thing with its own identity that a player can hold: a display
  name, a Rarity, and (optionally) art. Resources and the Gold coin are Items.
  An Item is the identity; its count in the Inventory is separate.
- **Rarity** — A tier classifying how scarce/valuable an Item is, surfaced to
  players as a signature color. Ordered common, uncommon, rare, epic,
  legendary. Generic placeholder colors for now.
- **Loot burst** — The in-world reward moment shown when an entity is depleted:
  the rolled Items visibly burst from the entity, arc out, and settle on the
  floor, each glowing in its Rarity color. Purely presentational — the loot is
  already awarded to the Inventory the instant the entity is depleted.

## Tooling

- **Content Zoo** — A development testbed scene used to build and tune the feel
  of foundational game elements (rendering, hit feedback, particles, sound,
  animation) in isolation, before assembling real Levels. Not shipped to
  players.
- **Level Editor** — A development tool for placing Entity instances into a
  Level via drag-and-drop and assigning per-instance data (loot table, HP,
  respawn rate), and for setting the Level's World bounds (width/height, never
  smaller than the Viewport). Saves LevelDefinition files that the real game can
  load; it shows the whole World fit-to-view. Concerns *where* entities are
  placed and *how large the World is* (per-Level), not what a type looks like.
- **Entity Editor** — A development tool for tuning the global visual transform
  of an Entity definition (scale, rotation, anchor). Edits apply to every
  instance of that type across all Levels. Concerns *what a type looks like*
  (global), not where instances are placed. Complements the Level Editor.

## Tools & Gating

- **Tool** — A held item that unlocks interactions (Axe, Pickaxe, Sword). Tools
  are not Resources: they are owned, gate which entities a player may damage, and
  come in tiers. Each tool the player holds is an instance of a Tool definition.
- **Tool definition** — The static, reusable content describing one tool (id,
  Tool type, Tool tier, display name, icon, optional Wield requirement). Tools are
  *identified*: the player owns a set of tool ids, e.g. `axe_rusty`, `axe_stone`.
  Tiers progress Rusty (found, tier 1) → Stone (crafted, tier 2) for both the Axe
  (Woodcutting) and Pickaxe (Mining) lines.
- **Tool type** — The category a tool belongs to (axe, pickaxe, sword), used by
  a Tool requirement to say *what kind* of tool an entity needs.
- **Tool tier** — A numeric rank on a Tool definition (higher = more capable). A
  Tool requirement may demand a minimum tier, so a basic tool of the right type is
  not always enough (e.g. an Oak Tree needs a tier-2 axe).
- **Wield requirement** — A Skill level a Tool definition needs to *use* it.
  Owning a tool is not enough if its wield requirement is unmet (e.g. the Stone
  Axe needs Woodcutting 3). A tool is *usable* only when its wield requirement is
  met.
- **Owned tool** — A tool the player has acquired (a tool id in their set). The
  set of owned tools is authoritative state.
- **Equipped tool** — The tool whose icon the cursor ring shows. Presentation-
  derived, not a gating input: the world auto-selects the best *usable* tool of
  the type an interaction needs, so the player never manually equips.
- **Tool requirement** — A gate on an entity declaring the Tool type (and
  optional minimum Tool tier) needed to damage it. Satisfied when the player owns
  a usable tool of that type at or above the tier.
- **Blocked** — The outcome of an interaction whose requirement is unmet. The
  world reports *why* so the presentation can explain it. Reasons: missing tool,
  tool tier too low, tool wield level unmet (owns it but Skill too low), or Skill
  level too low. (Design-doc cursor "Disabled / Blocked" maps here.)
- **Locked pickup** — A pickup that exists in the Level but is not yet
  collectible. It becomes collectible only when enabled (e.g. when the player is
  asked to take it), letting authored items sit inertly in the world beforehand.

## Skills

- **Skill** — A trainable proficiency the player levels by acting (Woodcutting,
  Mining, Combat, Crafting). Skills gate Wield requirements and some entity
  interactions, and are personal authoritative state.
- **Skill XP** — Experience accumulated in a Skill. Awarded by the world when an
  entity is depleted (its XP reward) and when a craft completes. The single source
  of truth for a Skill's progress.
- **Skill level** — The rank derived from Skill XP via the authored XP curve;
  recomputed (and stored) on every gain. Drives Wield requirements and gating.

## Crafting

- **Recipe** — Static, reusable content describing how to craft one result:
  resource cost, craft time, the tool it grants, and Skill XP awarded. Crafting is
  sim-authoritative and tick-based.
- **Crafting job** — A player's single in-flight craft, advanced in world ticks
  (no client timers). Consuming the cost starts it; after its duration the result
  is placed on the Shrine as an Offering. At most one per player.
- **Offering** — A crafted result sitting on a Shrine, waiting to be claimed.
  Unlike a Loot burst (auto-awarded, cosmetic), an Offering is real pending state:
  the player must claim it to take the tool.
- **System NPC** — A non-player character that fronts a game system in the
  fiction (e.g. Mr Smith fronts Crafting). He is the *voice* of the system,
  voicing reactions to crafting and progression beats; the physical interaction
  point is the relevant station, not the NPC. The crafting prompt opens from the
  Furnace (the forge), while Mr Smith reacts to it.

## Quests

- **Quest** — A named unit of directed progress with one or more Objectives and
  rewards. Quest progress is personal to a player, even in shared Levels.
- **Objective** — A single measurable goal within a Quest (e.g. "Pick up the
  Axe", "Chop Trees 0/3", "Rebuild the Shack"). Objectives advance from generic
  gameplay events, not quest-specific hooks.
- **Reward** — What a Quest grants when it is claimed. The prototype rewards
  Gold (visible); a Quest may also carry XP, authored now but not yet surfaced.
  A reward may also produce an **Interaction unlock**.
- **Interaction unlock** — A world-effect a Quest reward applies on Claim:
  enabling previously locked Entities by tag (a pickup, the furnace, the shrine).
  This is how the Quest chain opens up new interactions step by step, driven by
  data in the sim rather than scripted by the client.
- **Quest chain** — A sequence of Quests linked by prerequisites. Claiming a
  Quest auto-grants any Quest whose prerequisites are now all claimed, so the
  chain self-propagates in the sim without client scripting.
- **Claim** — The player action that collects a completed Quest's Reward. A
  Quest moves through three states: active, then completed (Reward ready to
  claim), then claimed (Reward taken).
- **Quest Tracker** — The HUD element listing a player's active Quests and their
  Objective progress, and where completed Quests are claimed.

## Building & Prompts

- **Buildable** — An entity that can be constructed or repaired by spending
  Resources. It has a built look and an unbuilt look; an unbuilt Buildable is
  inert (not damageable) until built. A Buildable instance may be authored to
  start built or unbuilt.
- **Build cost** — The Resources required to build a Buildable. May list several
  Resources (e.g. the furnace costs Stone and Wood); the player must afford every
  entry, and all are consumed on Build.
- **Build** — The act of paying a Build cost to turn an unbuilt Buildable into
  its built look. Consumes the Resources from the player's Inventory.
- **World Prompt** — A floating, in-world prompt anchored above an entity and
  styled like a Speech bubble: it shows an icon plus progress/status, can turn
  "ready", and may be tapped to act. Generic and reusable, not tutorial-specific.
- **Build Prompt** — A World Prompt bound to an unbuilt Buildable: it shows
  progress toward the Build cost (turning ready/green when affordable) and, when
  tapped while ready, Builds the entity.

## Onboarding & Presentation Flow

- **Title Screen** — The first surface a player sees: an ethereal holding screen
  with a "Click/Touch to Start" prompt. Entry point to the rest of the game.
- **Wisp** — A small, drifting, firefly-like mote of light. Ambient atmosphere
  (not an Entity, no HP, not interactable), used on the Title Screen and during
  the Onboarding cinematic.
- **Onboarding** — A first-time player's introductory experience. It has two
  distinct phases:
  - **Void cinematic** — A scripted, non-interactive-world sequence shown over
    blackness (props unveil and break on cue, Wisps drift). It is presentation,
    not authoritative world state.
  - **Playable tutorial** — The live Level revealed after the cinematic, where
    the player interacts with real Entities (gated by Tools) and follows Quests.
- **Director** — The client-side controller that scripts the Onboarding: fades,
  void props, tap-counting, the reveal, and NPC dialogue. It drives the world only
  through the same commands any player action uses; it is never part of the
  authoritative simulation. It grants only the first Quest — the rest of the Quest
  chain self-propagates in the sim (see Quest chain).
- **Camera** — The presentational viewpoint onto the world: a zoom/pan applied
  to the world layers (background, ambient, Entities and their Speech bubbles,
  world effects) as a unit, so the view can focus and reframe. It is pure
  presentation; it never changes authoritative world state. The Cursor and HUD
  live in screen space and are unaffected by the Camera. It is driven either by
  the **player** (free panning to navigate a world larger than the viewport) or
  by the **Director** (scripted focus/reframe for cinematic moments); while a
  cinematic owns the Camera, player panning is suspended and handed back to the
  player's resting view when the cinematic releases it.
- **Viewport** — The fixed-size window the Camera shows onto the world (the
  authored virtual resolution). Distinct from the World, which may be larger:
  the player pans the Camera to bring different parts of the World into the
  Viewport.
- **World bounds** — The full pannable extent of a Level (its authored
  width/height). The player-driven Camera is clamped to the World bounds, so the
  Viewport never reveals anything past the edge of the World. A World the same
  size as the Viewport cannot pan.

## Audio

- **Music** — A looping background track for a scene or moment, played on its
  own channel (separate volume from sound effects), able to fade in and out.
  Distinct from one-shot sound effects.
