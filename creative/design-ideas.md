# Design Ideas — Scratchpad

> **Status: exploratory design brainstorm — NOT canonical.**
> Raw ideas as they come. Nothing here is decided or specced.
> If an idea graduates into a real decision, it gets an ADR in
> [`docs/adr/`](../docs/adr/README.md) and vocabulary lands in
> [`CONTEXT.md`](../CONTEXT.md).
>
> **Priority ratings and reviews are maintained per the
> [creative docs protocol](../.cursor/rules/creative-docs.mdc).
> Re-review every item when this doc is updated.**
>
> Last reviewed: 2026-06-25 *(loot reel locked from mockup — form/overflow/fanfare/both-modes decided; introduces the cross-cutting **Item Card** visual language, specced in ux-housekeeping.md)*

---

## Vision

I want this to be my masterpiece. The game that represents everything I enjoy
about games. Designed in a way that feels social, enjoyable and addicting — with
a great grind of course.

---

## Loot drop carousel — the loot reel (slot wheel)

> **Priority: HIGH — in active design (grilled 2026-06-25; mockup locked)**
> Impact: Directly enhances the core active-play loop (the most-used path every session).

When loot drops, a **vertical loot reel** runs down the **left edge** of the screen,
constantly cycling the items you receive. The decisions below are **locked** (grilling
session + reference mockup: [`mockups/item-card-loot.png`](mockups/item-card-loot.png)).

### Form & placement
- **Vertical reel, left edge.** Newest drop enters at the **top**; older entries
  shift **down**. Deliberately on the left so it never crowds the busy bottom-right
  corner (hover preview bar + Skill Tracker).
- **Hero + aging trail.** The newest tile is the **hero** — full size, full
  saturation. As new loot arrives, older tiles **shrink, desaturate, and fade** while
  moving down, then retire. **~3 tiles** visible (hero + 2 fading), matching the
  mockup. This gives the "constantly cycling" motion with a clear focal point instead
  of a noisy marquee.

### Tile = the Item Card
Each tile is the **Item Card** visual language (defined in
[`ux-housekeeping.md`](ux-housekeeping.md) → *Item Card visual language*): a
rarity-coloured gradient capsule, soft white rim + drop shadow, icon leading on the
left, a small uppercase rarity label above a big white **outlined display-font** name,
and a large white-outlined **quantity badge (`×N`) overhanging the top-right corner**.

### Overflow & speed-scaling
- **Adaptive speed:** the reel cycles faster as backlog grows — the "your power is
  growing" progression signal the doc always wanted.
- **Coalescing:** identical items arriving close together merge into one tile with a
  rising `×N` count (the big badge is built for exactly this) instead of spamming
  tiles.
- **Hard visible cap (~3):** excess folds into counts rather than backing the queue
  up — kills the "anxiety backlog" risk.

### Fanfare (rarity peaks without noise)
- **Rare+ only get audio:** escalating chimes + a visual flourish on the hero tile
  (Rare < Epic < Legendary).
- **Common/Uncommon are visual-only** (rarity colour + a subtle tile pop, no sound).
- The existing per-drop world loot SFX stays as the baseline "tick"; the reel layers
  Rare+ fanfare on top — no double-audio for commons.

### Active vs idle
- **The reel runs in both modes** (decided 2026-06-25). Coalescing absorbs idle
  bursts into `×N` tiles, so no separate idle variant is needed for now. The existing
  `IdleSessionPanel` grid tally stays as the per-session idle summary.

### Data / seam
- Pure presentation: hook a new `bindHud` case on `loot.rolled` (carries per-item
  `itemId` + `quantity`) into a new `lootFeed` store slice; mount the reel in the HUD
  layer. **No sim/protocol change** — loot is already auto-awarded (ADR-0007).
- `prefers-reduced-motion`: disable the scroll/scale animation; swap tiles instantly
  in a static stack.

**Review**

Pros:
- Presentation layer on an already-authoritative loot system (sim auto-awards loot;
  the reel is client-side). High ROI — no sim changes.
- Rarity fanfare creates emotional peaks that don't exist today (rare drops currently
  feel identical to commons).
- Adaptive speed makes progression *felt* without a number; coalescing + hard cap
  defuse the backlog-anxiety risk the original idea flagged.
- Establishes the **Item Card** language (see ux-housekeeping.md), which then
  propagates to the hover rail, "new item" toasts, and later Bag/Vendor.

Cons / risks:
- Left-edge placement must stay narrow so it never competes with the click target.
- Coalescing window needs tuning: too long and distinct drops merge confusingly; too
  short and bursts still spam.
- Rare+ audio must be distinct per tier or the escalation reads as one sound.

Notes:
- The existing Bag and Pixi loot burst stay unchanged — the reel is an additional
  feedback layer, not a replacement.
- This is the highest-ROI pure-presentation feature in this doc and the canonical
  home of the Item Card visual language.

---

## Custom scrollbar

> **Priority: LOW (polish sprint)**
> Impact: Perceived quality and aesthetic consistency across all scrollable panels.

Replace the default browser scrollbar everywhere in the game UI. It looks bad
and breaks the aesthetic.

Should be reskinned to fit the overall UI style — thin, subtle, thematic.

**Review**

Pros:
- Every scrollable panel is affected (Bag, Collection Book, Skill Trees, etc.),
  so one global fix has wide reach.
- Trivially noticeable to players who care about production quality.
- CSS-only or a thin wrapper library — implementation cost is low.

Cons / risks:
- Zero gameplay impact. Players farming rocks don't see scrollbars.
- A custom scrollbar that feels bad (sticky, hard to grab) is worse than the
  default. Needs accessibility testing.
- Can conflict with browser/OS accessibility settings if done carelessly.

Notes:
- Best tackled as part of a dedicated UI polish sprint, not in isolation.
- Do not block any gameplay feature work on this.
- Consider a CSS-only approach first (`::-webkit-scrollbar` + `scrollbar-width`
  for Firefox) before reaching for a library.

---

## Shop unlock via hatch / breakable gate

> **Priority: MEDIUM**
> Impact: Turns Shop access into a quest beat — a memorable "key item" moment
> instead of a menu you stumble into.

Gate access to a Shop (or a specific Vendor stall) behind a world object the
player must break — a **hatch**, sealed door, rusted grate, or similar entity —
using a **specific Item bought (or earned) from that Shop** (or from a prior
Vendor). Classic quest-key loop:

1. Player discovers the blocked entrance / hears about a Vendor they can't reach.
2. They trade elsewhere (or at a partial stall) for the tool or key Item.
3. They return, use the Item on the hatch (drag-to-entity or tap-with-item-armed),
   break it, and the Shop / back room opens permanently.

- Works as onboarding for the Black Market *or* as a template for future Vendors
  (Jim's Gym, specialty stalls, etc.).
- The hatch entity can stay broken per-player (see ADR-0025 permanent entity
  state pattern — Giant Stump precedent).
- Pairs naturally with `itemInteractions` (ADR-0018) for "use item on entity"
  without bespoke quest code in the sim.

**Review**

Pros:
- Diegetic quest structure: players *earn* Shop access instead of reading a tooltip.
  Feels like OSRS / classic MMO key quests without heavy scripting.
- Reuses existing systems: Vendor tap-to-open, item-on-entity interactions, optional
  per-player permanent break state. No new authority boundary.
- Creates a natural place to teach "buy key → use key → new content" before Buy
  tab stock exists.
- One broken hatch is a strong visual milestone — other players see you've opened
  it (multiplayer social proof).

Cons / risks:
- Black Market sell is already live and reachable today. Applying this retroactively
  needs a deliberate beat (tutorial gate, second stall, or "back room" Vendor) —
  don't hide the only sell sink behind a grind wall without tuning.
- "Buy from the shop you're trying to unlock" is a chicken-and-egg unless a partial
  exterior stall or quest NPC grants the first key Item.
- If the key Item is consumable-on-use, inventory UX must be clear; if it's a Tool,
  it clutters the bar unless it's also useful elsewhere.

Notes:
- Design the key Item to have secondary value (small stat bump, cosmetic, or
  reusable on similar gates) so it doesn't feel like a pure toll.
- Consider a **Quest** that points at the hatch + names the required Item — keeps
  logic data-driven (ADR-0009) rather than a one-off Director.
- Good candidate for a Black Market "back room" Vendor once Buy tab ships; sell-only
  General vendor can stay accessible for the economy that's already built.

---

## Stack limits + wood refinement at the saw

> **Priority: DECISION FIRST (stack cap), then MEDIUM (saw refinement)**
> Design questions: Should raw gatherables cap at 20 per stack? Does refinement
> live as a world interaction, a crafting job, or both?

### Stack cap experiment

Try limiting **rock and wood** Item stacks to **20** in the Bag. Forces more
frequent inventory churn and makes "what do I do with surplus?" a sharper
question — sell, refine, Collection, or craft.

### Saw refinement loop

Place a **saw** (or similar workstation entity) in the world. The player **drags
one wood stack at a time** from the Bag onto the saw:

- Input: one stack of raw wood (e.g. Logs).
- Output: refined wood (e.g. Planks) — a separate Item definition.
- Refined wood **sells for more Gold and XP** than raw wood at the Vendor, but
  costs time and attention (active processing vs dump-and-sell).

One stack per interaction keeps the loop readable and avoids instant bulk convert.

### Future upgrades (long-term hooks)

- An **Artifact** might auto-convert chopped wood into planks on gather (skip the
  saw trip entirely) — see **Artifacts** section.
- A **Skill Tree node** (Woodcutting?) could grant the same behaviour — Artifact
  vs tree is a product choice: chase relic vs build choice.
- Either path preserves the refined Item as the better sell target so the economy
  anchor stays meaningful.

**Review**

Pros:
- Stack cap makes the Bag feel physical; idle sessions can't silently hoard infinite
  raw mats without thinking.
- Drag-to-saw is tactile and fits the god-cursor fantasy — you're placing material
  on a machine, not opening another menu.
- Refined > raw sell values create a clear skill expression: lazy sell vs process
  for margin. Mirrors real idle-game "process then sell" loops.
- Plank Item + saw entity are content additions (`items.ts`, level placement,
  `itemInteractions` or a small generic `item.process` command) — system stays
  generic.

Cons / risks:
- Stack cap of 20 may frustrate during long idle sessions if auto-sell isn't
  available. Needs playtesting; other categories uncapped could feel inconsistent.
- Drag-one-stack-only is slow at high volume — intentional friction, but could
  feel bad without idle/auto-refine unlocks later.
- Refined wood must not invalidate Collection entries that count raw Logs; either
  Collections stay on raw drops only, or Planks are a separate Collection track.
- Saw + sell margin must be tuned against Collection XP (ADR-0027: Collections
  stay optimal-but-slower). Refining should sit between raw sell and Collection
  hold, not beat Collections.

Notes:
- **Decision first:** pick the stack cap (20 is a starting experiment, not gospel)
  and whether caps apply only to gatherables or globally.
- Prototype saw as client drag → sim command (`item.process`? `item.useOnEntity`?)
  before committing to tick-based crafting parity with the Furnace.
- Name the refined Item in content (`wood_plank`, etc.) — don't overload the raw
  Log definition (ADR-0018 stateful-items pattern).
- Artifact / skill-tree auto-plank is **LONG-TERM** — document now, build after
  saw loop feels good in hand.

---

## Artifacts — Cursor equipment (supersedes traditional Gear)

> **Priority: HIGH — dedicated sprint (own ADR)**
> Impact: Thematic power progression for Cursors, unlocks Vendor **Buy** stock,
> and fills the long-anticipated third source in `deriveStats`.

We are **not** doing traditional gearing — we're Cursors; swords and armour don't
fit. Instead: **Artifacts** — equippable relics slotted into **Artifact slots**
unlocked via the **Clicker Skill Tree** as the Clicker levels up.

Artifacts aren't just flat Stat sticks. They grant **cool behavioural effects**
that change how you play:

- **Skill enhancers** — e.g. a Woodcutting Artifact that increases XP earned by a %.
- **Proc / AoE effects** — e.g. when you damage a tree, energy **zaps nearby trees**
  for bonus damage (chain-lightning gather style).
- **Rhythm procs** — e.g. every 3rd tap has a small chance to **Smite**.
- *(Room for many more — authored per Artifact in content.)*

### Chase items

Artifacts should be **super cool chase items** — things players hunt for:

- **Crafted** from rare mats (pairs with saw refinement, Furnace, etc.).
- **Quest rewards** (data-driven unlock beats).
- **Super-rare drops** from special entities / rare spawns (see below).

### Technical seam

The "future Gear" hook in `deriveStats` (ADR-0022: `base + Skill Tree (+ future
Gear)`) still applies — implementation adds an **Artifacts** source at the same
choke point. Vocabulary should say **Artifact**, not Gear, when this ships.

Open design questions:

- How many Artifact slots, and which Clicker-tree nodes unlock each?
- Flat Stat bonuses on Artifacts vs pure proc effects vs hybrid — mix policy?
- Can multiple Skill-specific Artifacts equip at once, or one "signature" per Skill?
- Sim authority: procs (Smite, AoE zap) must emit through commands/events, not
  client-only VFX.
- Relationship to **Tools** (auto-equipped tier gates) — Tools stay access keys;
  Artifacts are the power fantasy layer.

**Review**

Pros:
- Thematically perfect for god-Cursors — relics of power, not leather boots.
- Behavioural effects (AoE zap, Smite procs) are more exciting than +5% Tap Damage
  and differentiate chase items.
- Clicker-tree slot unlocks tie account progression to loadout depth cleanly.
- Gives the deferred Vendor **Buy** tab meaningful stock and Gold a power sink.
- Pairs with rare-spawn entities as drop sources — a full chase loop.

Cons / risks:
- Proc/AoE effects need sim-generic handlers (not one-off per Artifact in systems
  code) or content authoring becomes expensive.
- Multiplayer AoE on shared entities needs clear ownership rules (who gets credit
  for zapped trees?).
- Power inflation vs Skill Tree — same tuning concern as the old Gear idea.
- Larger sprint: definitions, equip UI, `deriveStats` + proc hooks, Vendor Buy,
  crafting recipes, drop tables.

Notes:
- **Supersedes** the earlier "equippable Gear" framing in this doc and ADR-0027
  deferral notes — same sprint slot, different creative direction.
- Should land as its own ADR + `CONTEXT.md` vocab (Artifact, Artifact slot).
- Example rare drop: Mining Artifact from the timed rare stone spawn (below).
- Saw-refinement auto-plank idea can live as an Artifact *or* a Skill Tree node —
  product choice documented in the stack-limits section.

---

## Timed rare spawns — contested world events

> **Priority: MEDIUM (HIGH once Artifacts ship)**
> Impact: Multiplayer excitement, chase-item sources, and a reason to stay on a Level.

Some entities are **rare spawns** with **long, variable respawn timers** to prevent
camp-and-abuse:

- Example: a special stone that respawns in **180–240 seconds** (random variance
  within range).
- **Higher HP** — a mini-event, not a one-tap gimmick.
- **Better loot table** — nicer mats plus a **chance to drop a Skill Artifact**
  (e.g. Mining).
- Players **contest** the spawn in shared Levels — race to find it, fight over
  the last hits, celebrate the drop. Competitive social energy.

### Level-wide announcement

When a rare spawn appears, broadcast a **system-style message / notification** to
**everyone in the Level**:

> *"A RARE [Entity Name] has spawned!"*

Uses the same family of UI as future system messages (server → client fan-out).
Presentation-only wrapper around an authoritative sim event (`entity.rareSpawn` or
similar).

**Review**

Pros:
- Creates organic multiplayer moments without PvP — shared scarcity, friendly rivalry.
- Variance in respawn window prevents timer camping and bot abuse.
- Natural drop source for Artifact chase items without gating everything behind
  crafting.
- Announcement makes the Level feel alive — other players know something is happening.

Cons / risks:
- Needs server-authoritative spawn scheduling in multiplayer (InstanceDO), not
  client-only timers.
- "Who gets the Artifact drop?" on shared kill — loot ownership rules must be
  explicit (killer, tagger, per-player roll, etc.).
- Announcement spam if too many rare types exist — cap concurrent rares per Level.
- Long respawn + high HP can frustrate solo players if tuning is MP-first.

Notes:
- Start with **one** rare spawn per Level archetype (one mining rare, one wood rare).
- Tie respawn variance to content (`respawnMin` / `respawnMax` on entity def or
  a `rareSpawn` tag).
- Announcement is a presentation layer on a sim event — same boundary as loot
  bursts (ADR-0007).
- Escalate to **HIGH** priority once Artifacts system is specced — rare spawns are
  the best multiplayer showcase for chase drops.

---

## Region travel via repaired portals *(supersedes "grounded teleporter" framing)*

> **Priority: MEDIUM (HIGH once multiple regions are live)**
> Impact: Strengthens world identity and gives region transitions a clear
> progression beat instead of a utilitarian warp.

Travel between major regions should use **blue arcane portals**, not grounded
signpost-style teleporters. The fiction stays diegetic ("ancient transit gates"),
while the deeper truth is that Cursors are effectively moving between authored
simulation regions.

Core beat per region:

1. Player enters and farms local entities/resources.
2. They collect a region-linked repair component.
3. They repair or power the portal in that region.
4. Portal activates and unlocks travel to the next region node.

Presentation direction:

- Portals should feel "special": animated, luminous blue energy, readable from
  distance, strong activation moment.
- Inactive vs active state must be visually obvious at a glance.
- Activation should feel earned (short flourish / pulse / audio cue) but remain
  presentation-only around an authoritative unlock state.

**Review**

Pros:
- Gives the world map a stronger signature than generic teleports; "portal
  network" is a memorable pillar players can describe.
- Creates a clean micro-progression loop inside each region (farm local content
  -> repair gate -> unlock travel), which pairs naturally with existing gather
  gameplay.
- Supports future pacing: portals can gate region order without bespoke one-off
  scripts in sim systems.
- The "simulation regions" lore thread gains a subtle delivery channel without
  exposing the meta premise directly.

Cons / risks:
- Needs careful friction tuning: if repair requirements are too grindy, travel
  feels blocked rather than motivating.
- Requires strong readability in busy scenes so portals do not get lost among
  entities and props.
- Region unlock sequencing must avoid soft-lock feelings for players who switch
  Skills and farm atypical routes.
- If this lands before multiple destination regions exist, players may perceive
  it as cosmetic ceremony with no payoff.

Notes:
- **Reconcile with shipped Travel (ADR-0023/0026).** Inter-Level Travel *already
  exists*: Beacons (ADR-0023) and edge-to-edge signpost Travel with Arrival
  Anchors (ADR-0026 — the north **signpost** in `bigworld_01` goes to
  `deepwood_01`; a south **beacon** returns). So this idea is **not** a clean
  "supersede"; scope it as the **next major-region** travel layer (repaired blue
  portals between large regions), with signposts/beacons remaining valid for the
  first region pair and local wayfinding.
- **DECISION FIRST:** do repaired portals *replace* beacons/signposts as the
  canonical major-region gate, or sit alongside them? If they become the canonical
  pattern, this needs its own ADR (a Travel-model migration on top of 0023/0026),
  since the "repair to activate" gate adds the first sim-authoritative Travel
  precondition (0023 deliberately has none).
- Keep unlock requirements data-driven (region/tag/content tables), not one-off
  scripted conditions.
- Candidate requirement pattern: one "regional core" item assembled from local
  farming drops, then consumed to activate that region's gate.
- **Escalation rule:** raise to **HIGH** when there are at least two destination
  regions ready to chain through portals.

---

## Equippable Gear that grants Stats *(superseded — see Artifacts above)*

> **Priority: SUPERSEDED**
> The Gear framing is retired in favour of **Artifacts** (same `deriveStats` seam,
> different thematic and effect model). Kept as a one-line pointer only.

## Items sell for XP — the economy question *(RESOLVED — shipped, ADR-0027)*

> **Priority: RESOLVED — shipped (ADR-0027)**
> Pointer only; the full record lives in the ADR + `economy.ts`.

Surplus loot is sellable at the Black Market General Vendor for **Gold OR
source-Skill XP** (player's choice), rarity-derived values tuned **below**
Collection-entry XP so Collections stay optimal-but-slower — the intended "Gold now
vs XP now vs hold for a Collection" decision layer. See ADR-0027 and
`packages/shared/src/content/economy.ts`.

Open follow-ups (not blocking): auto-sell convenience (monetization-survey
territory); Buy-tab stock once **Artifacts** lands.

---

## Jim's Gym — future character Vendor/Level *(sell role superseded by ADR-0027)*

> **Priority: LOW (future character Level; selling already lives at the Black Market)**
> Impact: A second Vendor identity and Level — not required now.

A buff gym-owner Clicker, **Jim**, whose gym frames a "train to get stronger" loop.
Selling shipped first at the Black Market (ADR-0027), so Jim is **not** the sell
sink. Keep him as a *future* Vendor only if he earns a distinct hook — Buy-tab
stock (once **Artifacts** ships), XP-boost consumables, or a hatch-gated interior
(pairs with **Shop unlock via hatch** above). Jim should be a fellow Clicker (a
trainer, not a mortal) whose voice stays in the sincere-bewilderment tone (never a
winking gym joke). A new Level means Editor/art/dialogue/Beacon work — only worth it
for a unique hook, not a duplicate sell screen.

---

## Monetization survey

> **Priority: LOW (timing-dependent)**
> Impact: Informs the entire monetization model — but only once there are enough
> players to get signal.

At some point once the build goes out to more people, run a survey asking:

> "What would you reasonably have any interest in paying for right now,
> whilst still being fair?"

Example prompts to include:
- Auto-sell from inventory
- Extra bag space
- Cosmetic cursor skins
- XP boosts (passive / limited time)
- Quality-of-life UI upgrades

This helps calibrate what players actually want to pay for before designing
the monetization model. Don't guess — ask.

**Review**

Pros:
- Data-driven monetization is the correct approach. Player-stated willingness to
  pay is far more reliable than developer assumptions.
- The example list is already well-targeted: auto-sell and extra bag space are
  the classic "convenience" monetization levers that feel fair to most players.
- Cursor skins already exist as an achievement-unlock cosmetic — a paid tier is
  a natural extension.

Cons / risks:
- Too early. Survey responses with a small player base will be biased by the
  player type currently playing (likely friends/testers, not representative).
- Survey fatigue: asking before players have enough experience to form opinions
  yields low-quality data.
- Auto-sell appearing as a paid feature could read as anti-player if the base
  game has a bad sell-UI. Fix the sell UX first, then consider selling convenience
  on top of it.

Notes:
- Revisit after a significant content update ships and player retention past
  session 5 is measurable.
- The survey itself takes no dev time; the cost is in timing and interpretation.
  Don't rush it.
