# Tales of Tileria — Core Game Design

> **What this doc is.** A concise statement of the game's *design intent* — the
> fantasy, the pillars, the tone, and the rules we hold ourselves to — plus a
> current-state summary of the systems that exist. It is **not** the authority on
> mechanics or vocabulary.
>
> - For **vocabulary**, [`CONTEXT.md`](../CONTEXT.md) is canonical and wins on any
>   conflict. (This doc's older "Area"/"Zone" both mean **Level**.)
> - For **why a system is the way it is**, read the [ADRs](../docs/adr/README.md).
> - For the **live game-loop snapshot** and near-term ideas, see
>   [`creative/`](../creative) and `.cursor/rules/creative-docs.mdc`.
>
> **Last reconciled with the codebase: 2026-06-25.** Where this doc and an ADR or
> CONTEXT disagree, they win; fix this doc to match.

---

## 1. Pitch

A browser-based idle "god cursor" game. The player is not a character who walks
the world — they are a divine cursor that breaks objects, moves tools, harvests
resources, crafts, completes quests, and reshapes the world through clicks,
hovering, and idle interaction. NPCs perceive the cursor as a mysterious divine
force and never see the machinery behind it.

It blends the active clicking + power growth of *Clicker Heroes* / *Cookie
Clicker*, the skill/resource/quest progression of *RuneScape*, the idle systems of
*Melvor Idle*, and the social presence of an MMO.

The fantasy to prove:

> "I am a godlike cursor interacting with a tiny fantasy world — helping,
> confusing, and terrifying its inhabitants while growing stronger through skills,
> loot, quests, and relics."

---

## 2. Design Pillars

### 2.1 Satisfying moment-to-moment interaction
Moving the cursor over entities, tapping for **Active damage**, and hovering/
**Locking** for **Passive damage** must feel good immediately — clear HP bars, hit
feedback, drops, and NPC reactions. The cursor should always feel like it has
physical force in the world.

### 2.2 Hybrid active + idle
Two play styles coexist: **active** (route between entities, tap fast — the
optimal path) and **idle**. "Idle" today means two distinct things, kept separate
in CONTEXT: **Lock** (pin the cursor to one target for hands-free Passive damage)
and **Idle Mode** (a sim-authoritative auto-gather state that detaches the cursor
and roams the Level — ADR-0024). Idle is useful but tuned below active.

### 2.3 Skill-based progression
Activities are tied to Skills (V1: **Mining**, **Woodcutting**; **Crafting**
supports them; Combat is deferred — see §7). A Skill's **Skill Tree** gates which
**Tier** of entity it can harvest and grows its Stats; see §6 and ADR-0022. Skill
level grants the tree's Skill Points.

### 2.4 Meaningful items and relics
Items should matter beyond raw numbers. **Tools** are access keys (own *an* axe to
chop, *a* pickaxe to mine — type only; tool tier no longer gates, ADR-0022).
Deeper power is the planned **Artifacts** system: equippable cursor relics with
behavioural effects (skill enhancers, proc/AoE), slotted via the Clicker tree —
the chase-item layer that supersedes the old "Gear" framing (see
`creative/design-ideas.md`; reserved seam in `deriveStats`, ADR-0022). Memorable
items unlock *new options*, not just bigger numbers.

### 2.5 MMO illusion with shared spaces
The world should feel online and social without full-MMO complexity. The open
world is a real, server-authoritative shared instance (ADR-0014/0016): players see
each other's cursors and break shared entities. Some moments stay private
(onboarding, story beats, personal crafting/Vendor scenes).

### 2.6 NPCs react to divine cursor activity
NPCs live *inside* the fiction and never see the machinery. They must **never name
the player's mechanics** — no "cursor", "click", "tap", "hover", "lock", or UI
verbs like "claim your reward". They react with sincere **bewilderment** at
impossible events: objects shattering on their own, tools drifting skyward,
materials appearing from nowhere. The humour is their genuine confusion, never a
wink at the player.

Examples:

- "The gods have taken my axe!"
- "Another request from above, is it?"
- "The very stones tremble, and I cannot say why…"
- "Please stop smashing my belongings, mighty one."

---

## 3. Core Loop (current state)

The authoritative live loop is summarised in `.cursor/rules/creative-docs.mdc`
(Current Game Loop Snapshot). In brief:

1. Cursor over an entity → **tap** (Active) or **hover/Lock** (Passive).
2. Entity depletes → **loot burst** (items auto-awarded to the Bag) + **Skill XP**.
3. Entity respawns; repeat. Efficient routing speeds active play.
4. Spend gathered output: register into the **Collection Book** for Skill XP, build
   the **Furnace** and **craft** (claimed at the Shrine, ADR-0010), or **sell** at
   the Black Market Vendor for Gold or source-Skill XP (ADR-0027).
5. Skill XP → levels → **Skill Points** → spend in the **Skill Tree** (unlock Tiers,
   grow Stats — ADR-0022). Broad levelling derives the **Clicker** meta-track, which
   gates **Idle Mode** (ADR-0024).
6. **Travel** between Levels via Beacons/edges (ADR-0023/0026).

(Loot is auto-awarded by the sim; the carousel/queue presentation idea is not built
— see `creative/design-ideas.md`.)

---

## 4. Cursor Interaction Model

Cursor states and damage types are defined canonically in CONTEXT (Free / Hover /
Click / Lock / Blocked; Active vs Passive). Key points:

- **Active damage** — high, from tapping; the optimal progression path.
- **Passive damage** — slower DoT on the current Target while hovering **or**
  Locked. The rate is the **same** whether hovered or Locked — Lock is a hands-free
  state, not a higher damage tier.
- **Lock** — pins a Target so Passive keeps ticking with no further input; the
  player may still tap while Locked.
- All Stats (Tap/Hover Damage, Hover Rate, Crit) resolve at one choke point,
  `deriveStats` (ADR-0022).

Balance direction (tune via playtest): Active dominates; Passive is the idle floor.

---

## 5. World Structure

The world is a set of **Levels** (CONTEXT is canonical; "Area"/"Zone" are retired
synonyms). Live Levels today: the shared open world **`bigworld_01` ("The
Clearing")**, the **Black Market** (`blackmarket_01`), and **Deepwood**
(`deepwood_01`, reached by edge Travel). Levels are authored in the Level Editor
and bundled into `@tot/shared`.

Design intent for Levels:

- **Layered, not disposable.** Earlier Levels keep value via rare drops, high-Tier
  locked resources, quest callbacks, skill-specific farming routes, and later quest
  steps.
- **Level archetypes:** private story (onboarding/cutscenes), shared resource (the
  open world), town/social (Vendors, crafting, shrines), and event (bosses, rare
  spawns — see the timed-rare-spawn idea in `creative/design-ideas.md`).

**Multiplayer ownership rules** are enforced per Level via `interactionRule`
(ADR-0014/0016): `lastHit` (open-world default), `claimed` (peaceful), and
`sharedContribution` (events; currently stubbed to last-hit). `personal` is
modelled as a per-player overlay rather than per-player instancing (ADR-0025).

---

## 6. Progression (current state)

- **Skill Trees replace flat upgrades (ADR-0022).** Completing a Collection Entry
  awards **Skill XP**; each Skill level grants one **Skill Point** for that Skill's
  tree. Trees gate harvest **Tier** and grow Stats; the root is free; respec
  refunds the whole tree.
- **Tools gate type only.** Own *an* axe/pickaxe to harvest at all; tool tier and
  wield-level no longer gate (the old `minTier`/`wieldRequirement` model is retired,
  ADR-0008 → ADR-0022). Tool tiers/crafting remain as content flavour.
- **Idle / meta (ADR-0024).** Broad Skill levelling derives the **Clicker** level,
  whose meta-track gates Idle Mode and per-Skill idle nodes.
- **Economy (ADR-0027).** Gold has a source/sink via selling at the Black Market;
  sell-for-XP routes to the item's source Skill; sell values are rarity-derived
  content, tuned below Collection-entry XP so Collections stay optimal-but-slower.
  Buying is a "coming soon" tab pending **Artifacts**.

**First power spike (intent):** gather → fill a Collection Entry → earn a Skill
Point → spend it for a Stat bump or a Tier unlock → feel the next node die faster
(or a new Tier open). Real progress within the first few minutes.

---

## 7. Prototype scope & deferrals

Proven in-build: cursor movement/clicking, Active + Passive damage, entity HP/
respawn, drops, shared multiplayer instance with visible cursors, quests, NPC
reactions, first tools, Skill XP/levels/trees, Collections, crafting, selling,
Idle Mode, Travel, leaderboards, cursor skins.

Deferred / not in V1 (do not document as live):

- **Combat skill, enemies, and the Stone Sword** — cut from the V1 chain; V1 is
  Woodcutting / Mining / Crafting ("deepen before you widen", §12).
- **Farming/offline crops** — aspirational; current idle is in-tab Idle Mode
  (ADR-0024), not offline crop timers.
- **Artifacts**, **timed rare spawns**, **stack caps + saw refinement**, **loot
  carousel** — design ideas, not built (`creative/design-ideas.md`).

---

## 8. Onboarding (current state)

The **active default is a minimal onboarding** (ADR-0021): a brief opening, the
player names themselves, then they enter the shared open world directly. The full
narrative arc — void cinematic → playable tutorial quest chain → **Ancient Tree →
Council of Clickers → Banishment** (ADR-0005/0009/0012/0013) — is **parked behind a
typed flag** (`ONBOARDING_VARIANT: 'arc'`) and stays authored, dev-runnable, and
testable. Onboarding scripting always lives in a client Director driving the world
through the same public commands (ADR-0005); the Player snapshot carries name,
tools, skills, inventory, and quests across the Level swap (ADR-0011).

The full quest chain (when the arc runs) is authored data in
`packages/shared/src/content/quests.ts` and self-propagates in the sim (ADR-0009)
— see that file and ADR-0009 rather than duplicating the table here.

Throughout, NPC voice stays sincerely bewildered and never names mechanics (§2.6).

---

## 9. Crafting fantasy

Crafting reinforces the god-cursor fantasy and stays **physical and active**, not a
silent menu transaction. The **Furnace** is the station — the craft prompt lives
over it. Materials fly into the forge, the Blacksmith *voices* the work (he is the
voice, not the station), the item is forged, and it waits as a glowing **Offering
on the Shrine** for the player to claim (ADR-0010).

Blacksmith line examples:

- "Ah, another request from the gods!"
- "Wood and stone from the sky again. Right. Let me fetch my hammer."
- "I do not question the floating sword. I merely craft it."

---

## 10. Loot & drops

Tiers of drop: **common** (constant use — Wood, Stone, Gold), **uncommon** (early
upgrades), **rare** (long-term goals), **ultra-rare** (prestige/cosmetic). Loot is
auto-awarded by the sim on depletion (ADR-0007); rarity should drive presentation
emphasis.

**Rare-drop philosophy:** ultra-rares are exciting but never required for normal
progression — they grant identity, prestige, cosmetics, convenience, or alternate
playstyles, not mandatory power. (Currency is **Gold**; "Coins" is retired.)

---

## 11. UI design rules

Stay readable and low-clutter. Visible at a glance: currency, current quest, cursor
identity, the entity under the cursor (the **Hover Preview Bar**, bottom-right —
name/HP/reqs/rewards/drop %, ADR-0028), and nearby players. Tools **auto-equip**
the best usable one for the target — there is no manual loadout hotbar (ADR-0008).
Hidden until needed: full loot tables, exact rates, skill breakdowns, detailed
stats, advanced recipes.

> Rule: only surface 2–3 important states per entity at once.

Two voices stay separate: in-world diegetic NPC speech vs out-of-world developer/
system messages (e.g. the welcome notice). They must look and read differently so
players never confuse the game's voice with the app's voice.

---

## 12. Design rules (first-core-loop addendum)

Defaults to be argued against, not casual preferences:

- **Progression unlocks interactions.** Advancement is gated by what the player
  *can now do*, not just bigger numbers — new Tiers, tools, and quest claims open
  new entities. Prefer "now you can interact with X" over "now X gives +10%".
- **Crafting is physical and active.** Crafting happens in the world (materials fly
  to the forge, the Blacksmith voices it, a glowing Offering on the Shrine to
  claim), never a silent menu. Active play is the high-value path; idle is the
  floor, not the ceiling.
- **Deepen before you widen.** Push Woodcutting, Mining, and Crafting further (more
  Tiers, more meaningful gates) before adding new Skills or systems. Three loops
  that feel great beat ten that feel flat.
- **The divine voice is consistent, and never meta.** NPCs and the world address
  the player as a named divine force (shrine, nameplate, dialogue all read the one
  authoritative Divine name). They never name the player's mechanics or use UI
  verbs; they react only with sincere bewilderment (§2.6). Out-of-world captions
  ("Tap to Mine") and system messages are a separate channel and may name mechanics.

> Note on an earlier rule: "own it, then grow into it" (a tool you own but can't yet
> wield) reflected the retired tool tier/wield gating. Access is now gated by the
> Skill Tree's Tier unlocks (ADR-0022), so this is no longer a live constraint.

---

## 13. Open design questions

Answer through prototyping and playtesting:

1. How fast should entities break during active play?
2. How efficient should idle (Lock / Idle Mode) be vs clicking?
3. Should loot auto-collect, require clicking, or depend on upgrades? (Currently
   auto-collected.)
4. How many players should share an open-world instance? (Currently `maxPlayers` 6.)
5. Should early resource nodes be claimed or shared? (Open world defaults `lastHit`.)
6. Should other players' damage numbers be visible?
7. How often should NPCs react before becoming annoying?
8. How much onboarding should be private before the shared world? (Minimal default
   today; full arc parked.)
9. Cursor cosmetics from day one? (Cursor skins exist, unlocked by Achievements.)
10. Should early gear be crafted, dropped, or quest-rewarded? (Relevant once
    **Artifacts** is designed.)
