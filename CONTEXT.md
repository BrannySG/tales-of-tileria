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
- **Divine name** — The name the player gives themselves at the end of the
  opening "tap rock, tap tree" intro (right before entering the shared world).
  Sim-authoritative (a `player.setName` command sets it; it is the Player's
  `displayName`) and persisted on the client, so the cursor nameplate, NPC
  lines, and welcome message all read it.
- **Cursor skin** — A cosmetic appearance for the player's Cursor: the arrow art
  shown for their in-world Cursor, their Networked cursor (as other players see
  them), and their HUD avatar. A player owns a set of *unlocked* Cursor skins and
  has exactly one *equipped*. A skin only changes how the Cursor looks, never the
  actor or its behavior. The same skin art is also reusable as the texture of a
  Cursor-being Entity placed in the Level Editor (e.g. the gold Council skin).
- **Default skin** — The Cursor skin every player has from the start (the cracked
  cursor). Always unlocked and equippable; the fallback when nothing else is
  equipped.

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
  state; the unlock flag rides the Player snapshot. In the active minimal intro
  flow, Smite is granted for the opening beats and revoked before entering the
  shared world. The longer Council/Banishment arc remains parked.
- **Banishment** — The arc beat in which the Council of Clickers strips the
  player's Divine power (Smite) and casts them into the mortal realm. It removes
  intro-only power **only** — Owned tools, Skills, Inventory, Divine name, and
  Quests are all retained — and is enacted as a real sim command, so the carried
  snapshot inherits the change. This beat is currently parked with the full
  Council arc.
- **Council of Clickers** — A court of celestial Cursor-beings who judge the
  player for meddling with mortals and enact the Banishment. Authored as a real
  Level (`council_01`) of Cursor-being Entities, scripted by a Director. This
  authored Level is currently parked with the full onboarding arc.

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
  further input. While Locked, the player may still tap for Active damage. Lock
  does not change Passive damage rate; it only removes the need to keep hovering.
  Distinct from **Idle Mode**: Lock pins the Cursor to *one* player-chosen target
  and is purely active-adjacent; Idle Mode detaches the Cursor and lets the sim
  *roam and reselect* targets for a chosen Skill on its own.
- **Idle Mode** — A sim-authoritative auto-gather state (ADR-0024). The Cursor
  detaches from the pointer and the sim drives it: it selects the nearest
  harvestable Entity of the player's chosen idle Skill(s), eases `cursor.x/y`
  toward it at **auto-move speed**, runs the existing Passive (Hover) tick on
  arrival, then reselects on depletion (waiting in place when nothing is
  harvestable). Toggled by `idle.start`/`idle.stop`; broadcast via the `'idle'`
  Cursor mode (the moon indicator). A Skill is idleable only when **both** the
  Clicker track's Idle Mode capability **and** that Skill's "<Skill> Idle" Tree
  Node are allocated. Because the loop is server-side, a backgrounded multiplayer
  tab keeps gathering.
- **Idle session** — The span between an `idle.start` and the matching stop/leave.
  Its running tally — total idle XP and the rarity/value-sorted loot grid in the
  session HUD — is **client-only and ephemeral**: it accumulates from authoritative
  events while idle and resets when idle ends. It is not sim or persisted state.

## World

- **Level** — An authored place a player can be in (e.g. "The Clearing"). This is
  the canonical term for a place. Created and saved by the Level Editor as a
  LevelDefinition. Retires the design-doc synonyms "Area" and "Zone".
- **Level instance** — A runtime, possibly-multiplayer copy of a Level, holding
  live state (entity HP, claims, respawn timers). Many instances can exist for
  one Level. A Player's personal state (Divine name, Owned tools, Skills,
  Inventory, Quests) is **portable across Level instances**: a snapshot can seed a
  new instance, so progress survives a Level swap (e.g. tutorial → Shared zone).
- **Travel** — Moving a Player from one Level to another at runtime, carrying
  their portable Player state. Mechanically a Level swap: the current Level
  instance/connection is torn down and a new one is built or joined from the
  carried snapshot, wrapped in a fade. It is **client-orchestrated** — there is no
  Travel sim command; the client reuses the same carry mechanism as onboarding and
  (for multiplayer Levels) reconnects to a new instance density-first. Triggered
  in-world by a Beacon (see ADR-0011, ADR-0023). The fade is informally called a
  "teleport"; the canonical verb is Travel.
- **Arrival anchor** — A named world point in a Level where a traveler arrives, so
  edge-to-edge Travel lands at the matching edge (a Beacon's `travelArrivalAnchor`
  selects one in the destination; exit south → arrive at the destination's "north"
  anchor). It only frames the destination camera — presentation, not sim state.
  A Beacon with no anchor keeps the legacy "arrive centred on the world" behaviour
  (see ADR-0026).
- **Shared zone** — The canonical networked open world (`bigworld_01`, whose
  in-world display name is **"The Clearing"**), the active destination right after
  first-run onboarding and the default destination for returning players in Game
  mode. The player's first time genuinely existing around other players: real,
  server-authoritative multiplayer (see ADR-0016), not faked presence. The retired
  `mortal_realm_01` was its single-player predecessor; its lived-in content is being
  folded into `bigworld_01`. *(Canonical public name is "The Clearing", matching the
  Level's `displayName`. The asset manifest still labels its background "Grass
  Plains" — a code-side label to reconcile separately; "The Open World" is an older
  synonym.)*
- **Black Market** — A shadowed trade Level where Vendors deal in Mortal Trade.
  It is a place, not a shop system; individual stores and transactions remain
  separate concepts.
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
- **Cursor-being** — An Entity kind for authored cursor-shaped presences (Council
  members, ambient crowd cursors, Vendors): non-damageable and non-reactive,
  scriptable or decorative set-dressing. Distinct from a mortal System NPC, and
  distinct from a **Networked cursor** (a real other player).
- **Vendor** — A non-celestial Cursor-being who fronts a Black Market stall and
  deals in Mortal Trade. A Vendor is a merchant presence, not a real player and
  not a System NPC. A *wired* Vendor is interactive: tapping it opens its Shop
  (see Shop, Sell; ADR-0027). Which Vendors are wired is data-driven by a client
  Vendor profile keyed on the placement's Cursor skin — the Black Market General
  vendor is the first; the Equipment and Generic vendors stay inert until given
  profiles.
- **Ancient Tree** — An imposing, effectively unbreakable Resource that gates the
  path beyond the tutorial. Striking it (especially with Smite) triggers the
  Council of Clickers cutscene. It is never actually depleted and remains a
  long-term aspirational gate ("you are not strong enough yet"). This gate and
  cutscene trigger are currently parked with the full onboarding arc.
- **Shrine** — A persistent Entity that receives crafted results: a completed
  Crafting job places its Offering on the Shrine to be claimed. Authored locked,
  enabled (undedicated) by a Quest reward, then Dedicated by the player.
- **Dedication** — The presentational act of naming a Shrine. When the player
  sets their Divine name at the enabled Shrine, the client renders it as "Shrine
  of [name]". In the active minimal onboarding flow, naming happens before
  entering the shared world and is separate from Crafting unlock. The
  shrine-centric Dedication beat is currently parked with the full arc.
- **Beacon** — An in-world Travel point: a landmark Entity that links two Levels.
  Tapping a Beacon prompts the Player to Travel to its destination Level. Each
  Beacon *placement* declares its own destination (authored as data on the placed
  Entity), so the same Beacon definition can link different Levels in different
  places. The prompt and the fade are presentation; the Travel itself is a client
  reconnect, not an authoritative sim action (see ADR-0023).
- **Personal Breakable** — A damageable Entity whose broken state is tracked **per
  Player** and persists forever: each Player whittles down and breaks their **own**
  copy (per-player HP in the sim), while others still see (and can break) theirs in
  the same shared world. The shared entity is never depleted; the sim projects the
  broken/intact state into each Player's snapshot and records broken ids on the
  Player (`brokenEntities`). Marked by a `personalBreak` component (see ADR-0025).
- **Landmark** — A one-time Personal Breakable that gates progression: breaking it
  reveals other Entities for that Player only (via `personalBreak.revealTag`),
  typically a Travel signpost to a new Level. The Mossy Giant Stump (the first
  Tier 4 Woodcutting Landmark) is the seed example (see ADR-0025).

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
  loot), keyed by item id with quantities. The authoritative data; the **Bag**
  is the player-facing window onto it.
- **Item** — A thing with its own identity that a player can hold: a display
  name, a Rarity, a **Item category**, a hover description, and (optionally) art.
  Resources and the Gold coin are Items. An Item is the identity; its count in
  the Inventory is separate. Stateful items are modeled as **separate Item
  definitions** (e.g. Bucket vs Bucket of Water), never per-instance state (see
  ADR-0018). Items are **multi-function**: the same Item can be a crafting cost,
  a sale good, and a Collection requirement. What an Item can do is conferred by
  the systems that reference it (recipes, Collection Entries), never locked by
  its Item category — the category is a presentational classification only.
- **Item category** — A player-facing classification of an Item: `resource`,
  `consumable`, `quest`, or `currency`. Drives Bag grouping and the tooltip.
  `currency` Items (Gold) are tracked in the Inventory but shown as the profile
  Currency total, never as a Bag stack.
- **Bag** — The docked HUD window onto the Inventory (think RuneScape's
  inventory). Its Items tab renders held Items as a slot grid (Gold excluded);
  its Equipment tab shows owned Tools read-only (the sim auto-equips). Open by
  default, toggled by a button or the I/B hotkey, with the preference persisted
  per device. The Bag is presentation; the Inventory is the data.
- **Item interaction** — A data-driven rule for "use Item on Entity" (authored
  like loot tables / recipes): a held Item + a target Entity (matched by
  definition id and/or tag) maps to an outcome that consumes/grants Items and
  may apply a world effect (e.g. Bucket + water → Bucket of Water; Bucket of
  Water + fire → Bucket, and the fire is extinguished). Resolved sim-side via the
  `item.useOn` command; a no-match is a silent no-op (see ADR-0018).
- **Armed item** — A client-only cursor mode: clicking an Item in the Bag arms
  it (the cursor carries its icon), and the next Entity click sends `item.useOn`
  for it. Transient presentation intent (like hover) — the sim only ever sees
  the resulting command. Clicking empty ground, re-clicking the item, or pressing
  the toggle disarms it.
- **Rarity** — A tier classifying how scarce/valuable an Item is, surfaced to
  players as a signature color. Ordered common, uncommon, rare, epic,
  legendary. Generic placeholder colors for now. Rarity drives presentation
  (loot-burst flourish, discovery toast) and informs collectible drop tuning; it
  is not itself a gate on Collection completion.
- **Loot burst** — The in-world reward moment shown when an entity is depleted:
  the rolled Items visibly burst from the entity, arc out, and settle on the
  floor, each glowing in its Rarity color. Purely presentational — the loot is
  already awarded to the Inventory the instant the entity is depleted.
- **Shop** — A Vendor's trade surface: the player opens it by tapping a wired
  Vendor (see Vendor) and trades there. Presented as a dedicated full-screen
  Vendor scene (the Vendor's Cursor-skin portrait bobs and speaks on the left;
  trade tabs on the right). The Shop has a **Sell** tab and a **Buy** tab; which
  tabs a Vendor offers is its role — the Black Market General vendor is the Sell
  hub, the Black Market **Equipment** stall is the first Buy Vendor (see ADR-0030).
  The scene is presentation; the trade itself is a sim command.
- **Buy** — Purchasing a piece of Equipment from a Vendor's **Buy stock** for Gold,
  sim-authoritative via the `item.buy` command (see ADR-0030). Validated against
  the stock line, affordability, and non-ownership; debits Gold and grants the
  Equipment to the owned set (it is **not** auto-equipped — the player equips it
  from the Bag). The starter Pickaxe is the first Buy (the Mining-unlock purchase);
  higher tiers are deterministic upgrades.
- **Buy stock** — The per-Vendor table of purchasable Equipment (`vendorStock`):
  Vendor id → `[{ equipmentId, goldCost }]`. Authored content; the sim validates
  against it and the client Buy tab renders the same table.
- **Sell** — Trading owned Items to a Vendor for either Gold or Skill XP (the
  **Sell mode**), sim-authoritative via the `item.sell` command (see ADR-0027). A
  no-op when the player owns too few, or when XP is requested for a Gold-only
  Item. Distinct from Registration (which donates Items into a Collection for a
  larger XP reward): selling is the fast, lossy route, Collections the slower,
  richer one.
- **Sell mode** — Which currency a Sell trades for: **Gold** (the player's income
  to spend) or **XP** (fed to the Item's source Skill — Wood → Woodcutting, Stone
  → Mining). Gold-only Items have no source Skill and hide the XP mode. The player
  chooses per sale; the trade-off (Gold now, XP now, or hold for a Collection) is
  a deliberate decision layer.
- **Sell value** — The per-unit Gold and XP an Item sells for. Derived from the
  Item's Rarity (a single rarity → `{ gold, xp }` table) with optional per-Item
  overrides; quantity multiplies. Authored content (see ADR-0027); sell-XP is
  tuned below the equivalent Collection-entry XP so Collections stay the better
  long play.

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
- **Sprite** — The umbrella term for a generated transparent art asset (an item
  Icon, an entity, an FX texture). A Sprite is the cut-out artwork itself; how it
  is used in-game (small in the Bag, large in the world) is a separate concern.
  Wired into the game through an Item's or Entity's `worldTextureId`.
- **Icon** — The specific small-art use of a Sprite: an Item's artwork as shown
  in the Bag and loot bursts. Every Icon is a Sprite, but not every Sprite is an
  Icon (entity and FX Sprites are not Icons).
- **Sprite Pipeline** — A local-only development tool that generates game-ready
  Sprites on demand (item Icons and world Entities): it prompts an image model
  against curated reference Sprites for visual consistency, removes the
  background, frames and downscales the result to the target sizes, and QA-checks
  it. A shared style core keeps every preset's output on one look. Callable by
  hand or by an AI agent (typically via a background subagent), which reads its
  structured verdict to accept or retry, and can scaffold the new Item/Entity
  wiring. Not shipped to players.

## Equipment & Gating

- **Equipment** — The umbrella for anything the player can *wear* into a slot to
  gain its effect (see ADR-0030). Equipment is owned, then deliberately **equipped**;
  equipping gates Skill access AND contributes Stats. `Tool` is the first
  Equipment subtype; `Artifact` is the next.
- **Equipment subtype** — A kind of Equipment. **Tool** (Axe, Pickaxe, Sword) is
  shipped; **Artifact** (relics with procs/effects) is designed-for and lands in a
  follow-up sprint, plugging into the same slot + Stat model.
- **Equipment definition** — The static base content for a piece of Equipment
  (id, optional `stats` mapping Stat keys → flat amounts). A Tool definition
  *extends* this with its Tool type, Tool tier, display name, and icon.
- **Equipment slot** — A named place a piece of Equipment occupies. Each Tool type
  is its own slot (`axe`, `pickaxe`, `sword`); Artifacts add new slots later. A
  slot holds at most one piece of Equipment.
- **Equipped equipment** — The authoritative record of what the player wears,
  `Player.equippedBySlot: slot → equipmentId`. Equipping is a deliberate player
  action (`equipment.equip` / `equipment.unequip`), **not** auto-derived (auto-equip
  was gutted by ADR-0030).
- **Tool** — An Equipment subtype that unlocks gathering interactions (Axe,
  Pickaxe, Sword). Tools are owned (a set of tool ids, e.g. `axe_rusty`,
  `axe_stone`), and must be **equipped** in their slot to grant access + Stats.
- **Tool type** — The category a tool belongs to (axe, pickaxe, sword); it is also
  the tool's Equipment slot, and what a Tool requirement names.
- **Tool tier** — A numeric rank on a Tool definition (higher = better). Tier is a
  **Stat-quality indicator**, not a gate (see ADR-0022/0030): higher tiers grant
  bigger `stats` (the tier-1 Rusty tools grant *access only*, no Stat bonus —
  the baseline upgrades read against; Stone/Iron add the bumps). Access is decided
  by the Skill Tree's Tier unlocks, not by which tool tier you hold.
- **Wield requirement** — A legacy Skill-level gate on a Tool definition. **No
  longer enforced** (see ADR-0022); the field stays in content but does not block.
- **Owned tool** — A tool the player has acquired (a tool id in their set).
  Authoritative state. Owning is necessary but **not sufficient** — it must be
  equipped to be used.
- **Equipped tool** — The tool currently in a Tool slot (`equippedBySlot[type]`).
  Authoritative and manual. The cursor ring shows the equipped tool's icon for the
  hovered entity's slot (or a generic icon when the slot is empty) — that display
  is presentation; the slot record is the source of truth.
- **Tool requirement** — A gate on an entity declaring the Tool *type* needed to
  damage it (e.g. needs *an* axe). Satisfied only when the player has a tool of
  that type **equipped** in its slot; tier is irrelevant (see ADR-0022/0030).
- **Blocked** — The outcome of an interaction whose requirement is unmet. The
  world reports *why* so the presentation can explain it. Reasons: owns no tool of
  the type (`missingTool`), owns one but it is not equipped (`notEquipped`), Tier
  not unlocked in the Skill Tree (`tierLocked`), or Skill level too low
  (`skillLevel`). (Design-doc cursor "Disabled / Blocked" maps here.)
- **Locked pickup** — A pickup that exists in the Level but is not yet
  collectible. It becomes collectible only when enabled (e.g. when the player is
  asked to take it), letting authored items sit inertly in the world beforehand.

## Skills

- **Skill** — A trainable proficiency the player levels by acting (Woodcutting,
  Mining, Combat, Crafting). Each Skill has its own Skill Tree; levelling grants
  Skill Points to spend in it. Personal authoritative state.
- **Skill XP** — Experience accumulated in a Skill. Awarded by the world when an
  entity is depleted (its XP reward), when a craft completes, and when a
  Collection Entry is completed (its XP reward, see ADR-0022). The single source
  of truth for a Skill's progress.
- **Skill level** — The rank derived from Skill XP via the authored XP curve;
  recomputed (and stored) on every gain. Uses a Melvor-style exponential threshold
  ladder and caps at level 99 (XP can continue accruing beyond cap for future
  progression). Each level grants **one Skill Point** for that Skill's tree, and
  gates which Tree Nodes can be allocated.
- **Skill Tracker** — The compact bottom-right HUD element listing each trainable
  Skill that has a Skill Tree, with its Skill level and an XP-to-next-level
  progress bar; clicking a Skill opens its Skill Tree. Like the Quest Tracker it
  is presentation only — it projects authoritative Skill state and never mutates
  it. (Skills appear automatically once they have a tree.)

## Collections & Skill Trees

- **Collectible Item** — An Item that can be Registered toward a Collection
  Entry. Not a distinct kind of Item: any Item referenced by a Collection Entry's
  requirements is collectible (generic Resources like Stone and Wood included).
  Stored as ordinary Inventory counts and consumed on Registration.
- **Source Family** — A class of gatherable Entity with its own collectible loot
  table, e.g. Basic Stone (Mining) or Basic Tree (Woodcutting). Future families
  (Oak Trees, Hard Rocks, Magic Stones) each get their own drops and Collections.
- **Collection** — A themed set of Collection Entries tied to a Skill (and, by
  framing, a Source Family or zone). V1: The Stone Ledger (Mining) and The Timber
  Archive (Woodcutting). Authored content.
- **Collection Book** — The HUD modal surface onto the player's Collections: it
  lists each Collection and its Entries, shows Collection Progress, and is where
  the player triggers Registration (single requirement or whole Entry). The Book
  is presentation; Collections, Entries, and Progress are the data.
- **Collection Entry** — One completable requirement within a Collection: a set
  of item requirements that are consumed on Registration in exchange for a **Skill
  XP** reward (see ADR-0022). Completed at most once. Authored content; quantities
  and rewards are data-tunable.
- **Registration** — The player action of donating Items into a Collection Entry,
  consuming the required quantities from the Inventory. Sim-authoritative and
  partial-allowed: it registers as much as the player owns toward the targeted
  requirement(s). A Registration may target a single required Item (registering
  just that Item) or the whole Entry (every requirement at once, "register all
  available"). The player chooses to register; drops are never auto-registered.
- **Collection Progress** — The Registered amount per required item on an Entry,
  plus whether it is complete. Personal authoritative Player state, portable
  across Levels.
- **Skill Point** — A per-Skill point earned **one per Skill level** (see
  ADR-0022), spent allocating Tree Nodes in that Skill's tree. `available =
  level − Σ(cost of allocated nodes)`. (Redefined from the old Collection-reward
  meaning, which is superseded by Skill XP.)
- **Skill Tree** — A per-Skill, connected graph of Tree Nodes the player
  allocates to grow Stats and unlock Tiers. Laid out as a legible vertical spine
  (alternating damage Stats with inline Tier gates) with short side branches. One
  per starter Skill (Mining, Woodcutting) in V1. The tree is the single gate on
  Tier access and the source of per-Skill Stat bonuses. Sim-authoritative
  (allocation is a command; the resolved Stat block ships in the snapshot and on
  change).
- **Tree Node** — An allocatable point in a Skill Tree: an `x/y` position, edges
  to neighbours, a per-Rank `cost` (Skill Points), a `levelReq`, a `maxRank`, and
  an effect — a **Stat** bonus, a **Tier unlock**, or one of the idle effects
  (**Idle Mode** capability, an **Idle Skill** marker, a **Cursor stat** bonus, or
  a benign anchor). A node may be allocated up to `maxRank` times (see **Rank**); a
  Stat/Cursor-stat node applies its amount once per Rank. Allocatable only when a
  neighbour (or the free root) has at least Rank 1, the level requirement is met,
  and enough Skill Points remain. The root is free, always allocated, and grants
  Tier 1.
- **Rank** — How many times a Tree Node has been allocated (`1..maxRank`). Each
  Rank of a Stat node adds its effect again (the bonus scales linearly with Rank);
  Tier-unlock nodes are single-Rank. Each Rank costs the node's `cost` in Skill
  Points. Distinct from **Skill level**, which is the Skill's overall rank derived
  from XP.
- **Respec** — Refunding every allocated Tree Node in a Skill's tree at once
  (full refund), returning all its Skill Points. A per-Skill action in the Skill
  Tree modal.
- **Tier** — A numeric rank on a gatherable Entity (T1, T2, …) declaring how far
  a Skill must have progressed to harvest it. The player may damage an Entity only
  when their Skill Tree has unlocked a Tier at or above the Entity's Tier (see
  ADR-0022). Replaces tool-tier/wield gating.
- **Stat** — A sim-resolved per-Skill combat/gathering value: **Tap Damage**
  (active click), **Hover Damage** (passive tick), **Hover Rate** (passive tick
  cadence, lower = faster), **Crit Chance**, **Crit Damage**. Resolved per
  interaction by the target Entity's Skill as `base + Skill Tree + Equipment`
  through one resolver (`deriveStats`); never computed anywhere else. The
  **Equipment source** is the piece equipped in the slot mapped to that Skill —
  today the equipped Tool's `stats`; Artifacts append here next (ADR-0030). (This
  is the third source ADR-0022 reserved and once framed as "Gear" — now generalised
  to Equipment.)
- **Crit** — A chance-based bonus on **Tap** damage only (seeded sim RNG for
  determinism): a crit multiplies Tap Damage by Crit Damage. Stacks
  multiplicatively with Smite (see ADR-0022).
- **Clicker** — A meta-track that gates and grows **Idle Mode** (ADR-0024), keyed
  `'clicker'` (a `TreeId`, not a `SkillId`). It is **not a Skill**: it has no XP,
  and its level is derived — **Clicker level** `= floor(Σ trainable-Skill levels /
  10)` — so it rewards breadth across every Skill. It reuses the Skill Tree
  machinery (nodes, Ranks, allocation, Respec) and is excluded from the Total-level
  and leaderboard economy. Its points spend exactly like Skill Points
  (`available = clickerLevel − Σ(cost × rank)`).
- **Cursor stat** — A player-global value resolved from the Clicker track that
  shapes Idle Mode: **auto-move speed**, **idle yield** (an XP % multiplier on idle
  gathers), and **multi-skill idle** (`maxIdleSkills`, how many Skills the single
  Cursor harvests among). Resolved through `deriveCursorStats` — parallel to
  `deriveStats`, which is untouched and skips the Clicker tree — and shipped as a
  `CursorStats` block in the snapshot, re-emitted on change. The general **Idle
  Mode** capability (whether idle is unlocked at all) resolves here too.

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

## Refining

- **Refining** — Converting a raw resource into a more valuable **Refined
  Resource** at a **Refinery** (see ADR-0029). A generic, data-driven loop,
  separate from Crafting: 1:1, batched, timed, and **tap-to-claim** — when the
  run finishes, the player taps the Refinery to collect the output into the Bag
  (like a crafting Offering). The first consumer is the Sawmill (raw wood →
  planks); Stone refining can reuse the same machinery later.
- **Refinery** — A station Entity where Refining happens, matched by a **station
  tag** (e.g. `sawmill`). Non-damageable scenery; its interactions are being the
  target of an armed raw Item and being tapped to claim a finished run.
- **Sawmill** — The woodcutting Refinery: arm a raw-wood stack and tap it to mill
  the batch into Refined wood, then tap again to claim it when it's ready.
- **Refined Resource** — The Refined output Item (e.g. Refined Wood/Oak/Pine). A
  more valuable trade good than the raw log; sellable and registered toward its own
  Collection entries.
- **Refine recipe** — Static, reusable content mapping a raw input Item + a
  station tag to a refined output, with a per-tier base time, default batch, and
  Skill XP per unit. Adding a refinery is new content, not system code.
- **Refine job** — A player's single in-flight Refining run, advanced in world
  ticks (no client timers), separate from the Crafting job. Consuming up to the
  batch of raw input starts it; after its (Skill-modified) duration it becomes
  **ready** and lingers until the player claims it, granting the refined output
  to the Bag with Skill XP. At most one per player.
- **Refine stat** — A per-Skill Skill-Tree-resolved Refining modifier: **batch
  size** (more raw consumed per run) and **speed** (shorter run, capped). Resolved
  by `deriveRefineStats`; the Woodcutting tree drives the Sawmill.
- **Interaction affordance** — The hover cue shown when an **Armed item** can act
  on the hovered Entity — either a Refine recipe (raw wood → Sawmill) or an Item
  interaction (bucket → water). One shared predicate (`canArmedItemInteract`)
  lights a glow so the "this can interact" signal is consistent everywhere.

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

## Achievements & Profile

- **Achievement** — A passive, sim-authoritative milestone the player completes by
  reaching a condition (e.g. a Skill level), as opposed to a Quest which is
  directed and explicitly claimed. Auto-evaluated (no Claim step); completing one
  may grant a Reward such as unlocking a Cursor skin. Surfaced in the Profile, not
  the Quest Tracker.
- **Profile** — The player-facing modal opened from the HUD avatar. It presents
  the player's identity (Divine name, equipped Cursor skin), Stats (Skill levels,
  owned Tools), the Cursor skin gallery, and Achievements. It doubles as the
  surface where the player previews and equips Cursor skins. Locked skins show a
  silhouette and their unlock condition.
- **Hover Preview Bar** — A sticky, fixed-position bar in the bottom-right of the
  screen that reads out the Entity currently under the Cursor: what it is
  (kind/flavor), its requirements, rewards, live status (HP/respawn), and its drop
  table with drop percentages. It is presentation-only and never mutates
  authoritative world state — it projects `buildInspectModel` + authoritative HP
  (see ADR-0028). Distinct from the player **Profile** (identity/progression). It
  **supersedes** the old right-click **Inspect** popover: the modal Inspect
  gesture + world-anchored panel were removed (ADR-0028), though the underlying
  `buildInspectModel` derivation it reused is kept and now feeds the bar.
- **New indicator** — A red dot that flags unacknowledged new content (a freshly
  unlocked Cursor skin or completed Achievement) on the HUD avatar and within the
  Profile. "Seen" is a per-device read-receipt held on the client, not
  authoritative Player state, so it may differ between browsers.
- **Leaderboard** — A cross-player ranking opened from a HUD trophy, showing the
  top players by a metric. V1 boards: Woodcutting level, Mining level, and Total
  level (combined across Skills). It is the game's **first persistent server
  state** — a single global SQLite Durable Object written server-side from the
  authoritative Instance, read over HTTP, never written by the client (see
  ADR-0019). Only players who have set a Divine name appear; only progress made
  while connected to a multiplayer Instance is recorded.

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
  active phases:
  - **Void opening** — A scripted, non-interactive-world sequence shown over
    blackness (props unveil and break on cue, Wisps drift): tap rock, tap tree,
    then name the player. It is presentation, not authoritative world state.
  - **Shared-world arrival** — After naming, the player enters the networked
    Shared zone (`bigworld_01`) and sees the welcome notice.
  - **Parked arc** — The longer tutorial + Council/Banishment sequence remains in
    the codebase behind a config flag.
- **Director** — The client-side controller that scripts the Onboarding: fades,
  void props, tap-counting, the reveal, and NPC dialogue. It drives the world only
  through the same commands any player action uses; it is never part of the
  authoritative simulation. In the active minimal flow it runs only the opening
  beats and naming handoff; the fuller quest/council scripting path remains parked.
- **Camera** — The presentational viewpoint onto the world: a zoom/pan applied
  to the world layers (background, ambient, Entities and their Speech bubbles,
  world effects) as a unit, so the view can focus and reframe. It is pure
  presentation; it never changes authoritative world state. The Cursor and HUD
  live in screen space and are unaffected by the Camera. It is driven either by
  the **player** (free panning to navigate a world larger than the viewport, and
  pointer-anchored zoom in/out clamped to the World bounds) or by the
  **Director** (scripted focus/reframe for cinematic moments); while a cinematic
  owns the Camera, player pan/zoom is suspended and handed back to the player's
  resting view (position and zoom) when the cinematic releases it.
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
