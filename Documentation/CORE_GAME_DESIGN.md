# Idle Cursor MMO — Core Game Design

> **Vocabulary note:** [`CONTEXT.md`](../CONTEXT.md) is the canonical glossary
> and wins on any conflict. In particular, this document's "Area" and "Zone"
> both map to the canonical term **Level** (a runtime copy is a **Level
> instance**). Treat such terms here as historical synonyms pending cleanup.

## 1. High-Level Pitch

A browser-based idle clicker MMO where players interact with a living fantasy world through a magical cursor. The player is not a normal character walking around the world. Instead, they are perceived by NPCs as a mysterious divine force: breaking objects, moving tools, harvesting resources, crafting items, completing quests, and reshaping the world through clicks, hovering, and idle interaction.

The game combines:

- The satisfying active clicking and power growth of **Clicker Heroes** and **Cookie Clicker**
- The skill, gear, resource, and quest progression of **RuneScape**
- The idle and offline systems of **Melvor Idle**
- The social presence and shared-world feeling of an **MMO**

The prototype should prove the core fantasy:

> “I am a godlike cursor interacting with a tiny fantasy world, helping, confusing, and terrifying its inhabitants while growing stronger through skills, loot, quests, and gear.”

---

## 2. Design Pillars

### 2.1 Satisfying Moment-to-Moment Interaction

The main action should feel good immediately:

- Move cursor over entities
- Click rapidly to deal active damage
- Hover or lock onto an entity to deal passive damage
- Break rocks, chop trees, damage enemies, collect resources
- See clear health bars, hit feedback, drops, and reactions

The player should always feel like their cursor has physical force in the world.

### 2.2 Hybrid Active + Idle Gameplay

The game should support two play styles:

#### Active Play

Players move between entities and click rapidly to break them faster. This should be the optimal way to progress.

#### Idle Play

Players hover over or lock onto an entity to deal slower passive damage while the game remains open. This allows the player to tab out or partially disengage while still making progress.

Idle progression should be useful, but not as efficient as active play.

### 2.3 Skill-Based Progression

Activities are tied to skills such as:

- Mining
- Woodcutting
- Combat
- Crafting
- Farming

Entities may require specific skill levels to interact with them. For example:

- Small Rock: Mining Level 1
- Copper Rock: Mining Level 5
- Ancient Tree: Woodcutting Level 50

Skills should unlock new resources, tools, gear, quests, and world interactions.

### 2.4 Meaningful Gear and Items

Items should matter. Gear should not only increase numbers; it should also unlock new mechanics and interactions.

Examples:

- Pickaxe: allows mining
- Axe: allows woodcutting
- Stone Sword: allows combat interactions
- Rare mining gloves: increase ore rarity
- Full woodcutting set: enables chain chopping nearby trees
- Divine charm: increases idle lock efficiency

Progression should feel like RuneScape: items become memorable because they unlock new options.

### 2.5 MMO Illusion with Shared Spaces

The game should feel online and social, but should avoid full MMO complexity during the prototype.

The first zone should be a small shared instance where multiple players can see each other and interact with shared resources.

Some sequences can be private, especially:

- Tutorial moments
- Story beats
- Personal crafting
- Quest-specific scenes

Shared zones should make the world feel alive without requiring a fully persistent global simulation.

### 2.6 NPCs React to Divine Cursor Activity

NPCs should not treat the player like a normal character. They should interpret player actions as divine, supernatural, or mysterious events.

NPCs live *inside* the fiction and never see the machinery behind it. They must **never name the player's mechanics** — no "cursor", "click", "tap", "hover", "lock", or UI verbs like "claim your reward". Instead they react with sincere **bewilderment** at the impossible things happening around them: objects shattering on their own, tools drifting up into the sky, materials appearing from nowhere. The humour comes from their genuine confusion, never from winking at the player.

Examples:

- “The gods have taken my axe!”
- “Another request from above, is it?”
- “The very stones tremble, and I cannot say why…”
- “Please stop smashing my belongings, mighty one.”

This tone should be playful, charming, and lightly absurd — but always sincere bewilderment, never meta-awareness.

---

## 3. Core Gameplay Loop

### 3.1 Primary Loop

1. Enter an area
2. Identify interactable entities
3. Click, hover, or lock cursor onto entities
4. Deal damage over time
5. Entity breaks, dies, or completes interaction
6. Player receives drops, XP, quest progress, or unlocks
7. Player upgrades gear, skills, and access
8. New entities, quests, and zones become available

### 3.2 Active Interaction Loop

1. Player selects a target
2. Player rapidly clicks to deal damage
3. Target loses HP with visible feedback
4. Player moves to next target while previous target respawns
5. Efficient routing improves progression speed

### 3.3 Idle Interaction Loop

1. Player hovers over or selects a target
2. Player locks cursor onto that target
3. Passive damage begins
4. Entity eventually breaks
5. Drops are collected automatically or after a simple collection prompt
6. Entity respawns after a timer
7. Lock may continue to next respawn if allowed by entity rules

### 3.4 Offline/Long Timer Loop

Some systems can progress while the player is away, but core farming should mostly require the game to be open.

Good offline-style systems:

- Farming crops
- Crafting timers
- Construction upgrades
- NPC errands
- Resource refinement

Example:

> Plant wheat, wait 6 hours, return to harvest.

---

## 4. Cursor Interaction Model

The cursor is the player’s main presence in the world.

### 4.1 Cursor States

#### Free Cursor

Default state. Player can move freely and inspect entities.

#### Hovering

Cursor is over an interactable entity. The entity displays relevant information such as name, HP, required skill, and possible action.

#### Clicking

Each click deals active damage or performs an action.

#### Locked

Player locks onto an entity. Cursor remains attached or focused on the target and deals passive damage over time.

#### Disabled / Blocked

Cursor cannot interact with an entity because requirements are not met, another player has claimed it, or the entity is unavailable.

### 4.2 Damage Types

#### Active Damage

High damage from clicking. This should be the most efficient progression method.

#### Passive Hover Damage

Low damage while hovering.

#### Lock Damage

Medium passive damage while locked. This is the main idle-open gameplay mode.

### 4.3 Suggested Balance Direction

Initial rough target:

- Active clicking: 100% efficiency
- Locked idle damage: 50–70% efficiency
- Simple hover damage: 20–40% efficiency

This should be tuned heavily through playtesting.

---

## 5. World Structure

### 5.1 Area-Based World

The world is composed of many small areas. Each area contains a focused set of activities, entities, quests, NPCs, and resources.

Examples:

- Grass Plains
- Pebble Cave
- Old Forest
- Riverbank
- Blacksmith Yard
- Goblin Hollow
- Shrine Town

### 5.2 Area Design Philosophy

Areas should not become irrelevant immediately after progression. Earlier areas may contain:

- Rare drops
- High-level locked resources
- Quest callbacks
- Hidden events
- Skill-specific farming routes
- NPCs with later quest steps

This creates a world that feels layered rather than disposable.

### 5.3 Zone Types

#### Private Story Zone

Used for tutorial and scripted sequences.

#### Shared Resource Zone

Used for normal farming and social presence. Zone 1 should use this model.

#### Town Zone

A larger social area with NPCs, crafting, shops, shrines, and quest hubs.

#### Event Zone

Used for bosses, rare spawns, competitions, and temporary events.

---

## 6. Multiplayer Interaction Rules

Different zones may use different resource ownership rules.

### 6.1 Claimed Interaction

First player to interact with an entity claims it. Only that player can damage or harvest it.

Best for:

- Normal rocks
- Trees
- Quest entities
- Personal progression resources

Anti-abuse requirements:

- Claims expire if the player stops interacting
- Claims expire after inactivity
- Claims may expire if damage contribution is too low
- Entity respawns are distributed enough to prevent blocking

### 6.2 Shared Contribution

Multiple players can damage the same entity. Rewards are based on contribution.

Best for:

- Bosses
- Large resource nodes
- Public events
- Rare world spawns

### 6.3 Last-Hit Rules

Whoever lands the final hit gets the main reward.

Best for:

- Optional chaos zones
- Competitive events
- High-risk/high-reward content

This should not be the default rule because it can easily feel frustrating.

---

## 7. Prototype / MVP Scope

The first prototype should prove the core game loop in one shared zone.

### 7.1 MVP Goals

The MVP should demonstrate:

- Cursor movement and clicking
- Active damage
- Idle lock damage
- Entity HP and respawning
- Basic resource drops
- Shared instance state
- Other players visible in the same zone
- Basic quests
- NPC reactions
- First tools and gear
- Simple skill XP
- Modular content definitions

### 7.2 MVP Area: The Grass Plains

The first zone is a small grassy area similar to the mockup.

#### Entities

- Small Rock
- Basic Tree
- Old Shack
- NPC Villager
- Axe Pickup
- Pickaxe Pickup
- Shrine / Offering Spot

#### Skills

- Mining
- Woodcutting
- Basic Combat or Tool Use

#### Starting Gear

- None initially
- Axe unlocked during tutorial
- Pickaxe unlocked shortly after
- Stone Sword unlocked as a later early reward

#### Resources

- Wood
- Stone
- Gold or Coins
- Basic loot items

---

## 8. Tutorial / Onboarding Flow

### 8.1 Tone

The tutorial should be playful and story-driven. The player should learn by causing chaos in the world.

### 8.2 Tutorial Sequence

#### Step 1: Darkness and Shack

The screen begins mostly dark. A small shoddy wooden shack is visible.

Prompt:

> Tap the shack.

Player clicks the shack repeatedly. The shack shakes, cracks, and breaks.

#### Step 2: Area Reveal

When the shack breaks, the surrounding area reveals. A shocked NPC appears beside the broken shack.

NPC reaction example:

> “MY SHACK! By the roots and rocks, what invisible menace has done this?!”

#### Step 3: First Quest

The NPC complains that they need wood to repair the shack but are too exhausted to gather it.

NPC:

> “I’d fix it myself, but after being personally attacked by the heavens, I need a minute. If only five bits of wood would mysteriously appear…”

Quest unlocked:

> New Beginnings — Gather 5 Wood

#### Step 4: Pick Up Axe

An axe appears nearby.

Prompt:

> Tap the axe.

The axe floats to the player’s inventory.

NPC reaction:

> “Oh good. The axe is floating away. That’s normal. Completely normal.”

#### Step 5: Chop Tree

Player uses the axe to damage a nearby tree.

Teaching points:

- Click tree to chop faster
- Hover to deal slow passive damage
- Lock cursor to idle chop
- Tree has HP and respawn timer

#### Step 6: Turn In Quest

After collecting 5 wood, materials fall near the NPC or shrine.

NPC:

> “The gods provide! Also destroy. But mostly provide, I hope.”

Reward:

- Coins
- Woodcutting XP
- Unlock Mining quest

#### Step 7: Mining Introduction

NPC notices rocks nearby.

NPC:

> “Since the sky-being is feeling helpful, perhaps the rocks could be persuaded to become stone?”

Player receives or collects a pickaxe.

Quest unlocked:

> Rock Bottom — Mine 5 Stone

---

## 9. First Quest Chain

### Quest 1: New Beginnings

Objective:

- Gather 5 Wood

Teaches:

- Picking up tool
- Chopping trees
- Entity HP
- Resource drops
- Quest tracking

Reward:

- Coins
- Woodcutting XP
- Unlock Pickaxe

### Quest 2: Rock Bottom

Objective:

- Mine 5 Stone

Teaches:

- Mining
- Tool requirements
- Different entity types
- Respawn timing

Reward:

- Mining XP
- Basic crafting unlock

### Quest 3: An Offering for the Smith

Objective:

- Bring 5 Wood and 5 Stone to the Blacksmith / crafting NPC

Teaches:

- Crafting request flow
- Materials dropping near NPC
- NPC crafting animation
- Shrine/offering collection

Reward:

- Stone Sword
- Unlock combat target / training dummy

### Quest 4: Something in the Grass

Objective:

- Defeat 3 Grass Slimes or Training Dummies

Teaches:

- Combat interaction
- Enemy HP
- Drops
- Combat XP

Reward:

- First combat item
- Unlock next area preview

---

## 10. Crafting Fantasy

Crafting should reinforce the “god cursor” fantasy.

The **Furnace (the forge)** is the physical crafting station — the craft prompt
lives over it, not over the Blacksmith. The Blacksmith remains the *voice* of
crafting: he reacts and narrates, but the player interacts with the forge.

Example flow:

1. Player clicks the Furnace (the forge)
2. Crafting menu opens
3. Player selects item
4. Required materials fly physically into the forge
5. Blacksmith reacts and voices the work
6. The item is forged
7. Item is placed on a shrine or offering table
8. Player clicks item to collect

Blacksmith line examples:

- “Ah, another request from the gods!”
- “Wood and stone from the sky again. Right. Let me fetch my hammer.”
- “I do not question the floating sword. I merely craft it.”

---

## 11. Entity Design

Each interactable entity should have:

- ID
- Display name
- Entity type
- Required skill
- Required tool
- HP
- Respawn time
- Loot table
- XP reward
- Interaction rule
- Visual state
- Optional NPC reaction hooks

Example entity types:

- Resource node
- Enemy
- NPC
- Pickup
- Quest object
- Crafting station
- Shrine

---

## 12. Early Progression

### 12.1 First 10 Minutes Target

In the first 10 minutes, the player should:

- Break the shack
- Meet the first NPC
- Pick up axe
- Chop first tree
- Learn active click damage
- Learn idle lock damage
- Complete first quest
- Pick up pickaxe
- Mine first rock
- Open basic crafting
- Receive first crafted item
- See at least one other player in the shared zone

### 12.2 First Power Spike

The player should quickly experience a noticeable improvement.

Example:

- Basic Axe: 1 damage per click
- Reinforced Axe: 3 damage per click

This makes progression feel real immediately.

---

## 13. Loot and Drops

### 13.1 Drop Categories

#### Common Drops

Used constantly.

Examples:

- Wood
- Stone
- Coins

#### Uncommon Drops

Used for early upgrades.

Examples:

- Strong Branch
- Smooth Pebble
- Resin Chunk

#### Rare Drops

Exciting long-term goals.

Examples:

- Tiny Tree Spirit
- Shimmering Bark
- Cracked Geode

#### Ultra-Rare Drops

Very low-rate prestige or cosmetic rewards.

Examples:

- 1 in 10,000 pet
- Cosmetic cursor skin
- Rare shrine decoration

### 13.2 Rare Drop Philosophy

Ultra-rare drops should be exciting but should not be required for normal progression. They should provide identity, prestige, cosmetics, convenience, or alternate playstyles rather than mandatory power.

---

## 14. UI Requirements From a Design Perspective

The game should stay readable and low-clutter.

Visible at a glance:

- Currency
- Current quest
- Cursor/player identity
- Equipped tool hotbar
- Entity name and HP when relevant
- Other players nearby

Hidden until needed:

- Full loot tables
- Exact drop rates
- Skill breakdowns
- Detailed stats
- Advanced crafting recipes

Rule:

> Only show 2–3 important states per entity at once.

---

## 15. Key Open Design Questions

These should be answered through prototyping and playtesting:

1. How fast should entities break during active play?
2. How efficient should lock-idle damage be compared to clicking?
3. Should loot auto-collect, require clicking, or depend on upgrades?
4. How many players should share a Zone 1 instance?
5. Should early resource nodes be claimed or shared?
6. Should other players’ damage numbers be visible?
7. How often should NPCs react before becoming annoying?
8. How much of the tutorial should be private before joining the shared zone?
9. Should the cursor have cosmetics from day one?
10. Should early gear be crafted, dropped, or quest-rewarded?

---

## 16. Design Rules (First Core Loop addendum)

These rules crystallised while building the first repeatable loop (gather → skill
XP → build → craft → unlock). They constrain future feature work; treat them as
defaults to be argued against, not casual preferences.

- **Progression unlocks interactions.** Advancement is gated by what the player
  *can now do*, not just bigger numbers. New tools, tiers, and quest claims open
  up new entities (the Oak you couldn't fell, the furnace you couldn't build).
  Prefer "now you can interact with X" over "now X gives +10%".
- **Own it, then grow into it.** A tool can be owned before it is usable (the
  Stone Axe needs Woodcutting 3 to wield). Goals you can see but not yet use are a
  deliberate motivator; the UI must say *why* it's blocked.
- **Crafting is physical and active.** Crafting happens in the world (resources
  fly to the System NPC, work/spark animation, a glowing Offering on the shrine
  you must claim) — not a silent menu transaction. Active play is the high-value
  path; idle is the floor, not the ceiling.
- **Deepen before you widen.** Push Woodcutting, Mining, and Crafting further
  (more tiers, more meaningful gates) before adding new skills or systems. Three
  loops that feel great beat ten that feel flat.
- **The divine voice is consistent, and never meta.** NPCs (and the world) speak
  to the player as a divine force with a name; the shrine, nameplate, and dialogue
  all read the one authoritative Divine name. NPCs live inside the fiction: they
  never name the player's mechanics ("cursor", "click", "tap", "hover", "lock") or
  use UI verbs ("claim your reward"). They react only with sincere bewilderment at
  the impossible events around them (see §2.6). Out-of-world tutorial captions
  ("Tap to Mine") and developer/system messages are a separate channel and may
  name mechanics.
- **In-world fiction and out-of-world dev messaging stay separate.** Diegetic NPC
  speech bubbles are not the same channel as developer/system messages (e.g. the
  Zone 1 welcome). They must look and read differently so players never confuse the
  game's voice with the app's voice.
