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
> Last reviewed: 2026-06-25 *(Artifacts direction, rare spawns, Collection juice)*

---

## Vision

I want this to be my masterpiece. The game that represents everything I enjoy
about games. Designed in a way that feels social, enjoyable and addicting — with
a great grind of course.

---

## Loot drop carousel — the slot wheel

> **Priority: HIGH**
> Impact: Directly enhances the core active-play loop (the most-used path every session).

When loot drops, create a slot-wheel-style carousel UI that's constantly cycling
through the items you're receiving. It should feel like a constantly moving slot
wheel.

- Emphasise rarity visually via the UI.
- Play different fanfare based on rarity (common = small chime, legendary = big
  moment).
- Items feel valuable and earned instead of just appearing.
- As players get stronger and gain items faster, the queue cycles faster too —
  so you'll see that wheel style element constantly spinning when actively
  playing. A tangible sense of your own progression.

### Active vs idle presentation

- **Active play:** the slot-wheel carousel (always moving, per-item fanfare).
- **Idle mode / not playing:** simplified list/grid of items gained, stacking
  things up. No fanfare needed; just a clean tally.

**Review**

Pros:
- This is a presentation layer on top of an already-authoritative loot system
  (loot is auto-awarded by the sim; the carousel is purely client-side). High
  ROI — no sim changes required.
- Rarity fanfare creates emotional peaks that currently don't exist. Rare drops
  feel the same as common ones right now.
- Speed-scaling as progression signal is elegant: players will feel their own
  power growth without a tooltip or number.
- Active vs idle split is already natural — the sim already distinguishes the two
  modes, so the presentation can branch cleanly.

Cons / risks:
- Queue overflow at high loot rates needs design: a carousel backing up is
  anxiety-inducing, not satisfying. Need a max queue length and a flush rule.
- Fanfare frequency can become noise very quickly. Common drops must be subtle
  or they drown out the rare moments. Needs tuning.
- Could distract from clicking (the primary action) if it takes too much screen
  real estate. Must stay peripheral.

Notes:
- The existing Bag and loot burst system stays unchanged — the carousel is an
  additional feedback layer, not a replacement.
- Implement the idle grid variant at the same time as the carousel; they are two
  faces of the same feature.
- This is the highest-ROI pure-presentation feature in this doc.
- Sequenced as its own focused follow-up sprint (split out of the Black Market
  Vendor sprint, ADR-0027): it has enough of its own design surface — queue
  overflow/flush, rarity fanfare tuning, active-vs-idle variants — to deserve
  dedicated attention rather than riding along with another feature.

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

## Equippable Gear that grants Stats *(superseded — see Artifacts above)*

> **Priority: SUPERSEDED**
> The Gear framing is retired in favour of **Artifacts** (same `deriveStats` seam,
> different thematic and effect model). Kept as a one-line pointer only.

## Items sell for XP — the economy question

> **Priority: RESOLVED — shipped (ADR-0027)**
> Original design question: Is XP a progression route for surplus loot, and how
> does it interact with Collections?

An idea: items should be sellable for XP, not just gold.

The standard to establish here:

- Are we a game about levelling up as far as you can? If so, loot drops should
  always be sellable.
- XP reward scales massively with rarity (e.g. common = small XP, legendary =
  big XP).
- **Tension with Collections:** a Collection Entry requiring 3 legendary drops
  might reward 8,000 XP, while selling each for 1,000 XP individually totals
  only 3,000 XP. A clearly more valuable reward — but it requires holding onto
  the drops. Players making that trade-off adds a nice thinking layer to the
  loop.

**Review**

Pros:
- Creates a genuine decision layer at every rare drop: sell now vs hold for
  Collection. This is the exact kind of thinking good idle/clicker loops reward.
- Filled the gap where items with no immediate use piled up in the Bag — sell
  is now the fast, lossy route (ADR-0027).
- Reinforces "XP is the core resource" framing via per-Skill sell XP routing.
- The Collection tension (sell 3x vs complete entry) remains the designed
  trade-off — Collections tuned above sell-XP.

Cons / risks *(mostly resolved at ship; kept for tuning)*:
- If sell-XP rates are too generous, players will sell everything and Collections
  become suboptimal — ongoing balance concern, not a blocker.
- Manual sell adds inventory management burden; auto-sell remains an open QoL
  question (monetization survey territory).

Notes:
- **Resolved:** dual `Gold | XP` sell mode at the Black Market General Vendor;
  XP routes to the Item's source Skill; sell values are rarity-derived and tuned
  below Collection entry XP. See ADR-0027 and `packages/shared/src/content/economy.ts`.
- Remaining open questions (not blocking):
  1. Auto-sell convenience (monetization survey territory).
  2. Buy tab stock once **Artifacts** system lands (supersedes Gear).
- This section stays as historical context for why Collections vs sell tension
  was designed the way it was.

---

## Jim's Gym — vendor for selling

> **Priority: LOW (superseded for sell; still valid as a future character Level)**
> Impact: A second Vendor identity and Level — not required now that the Black
> Market handles sell.

The Clicker we sell to could be a buff gym-owner Clicker called **Jim**. We go
to **Jim's Gym** to train ourselves up and get stronger. Sells as a character,
and the gym framing makes the "sell items → gain XP → get stronger" loop feel
physical and fun.

*(Originally noted as "waffling" — kept because the name and vibe are strong.)*

**Review**

Pros:
- "Jim's Gym" is immediately evocative. The gym-as-power metaphor maps cleanly
  onto the sell-items → gain strength loop without needing to explain it.
- Jim as a Cursor-being NPC (see CONTEXT.md: Cursor-being) fits the existing
  entity model perfectly. No new system needed for the character itself.
- A distinct Level for the Gym gives a reason to travel, adding loop variety.

Cons / risks:
- Sell already lives at the Black Market — Jim risks duplicating a screen unless
  he offers something distinct (Buy stock, training minigame, hatch-gated back room).
- A new Level means Level Editor work, art, NPC dialogue, and a Beacon placement.
  Non-trivial for what is initially just a sell screen.
- "Gym" framing may clash with the mystical/divine aesthetic if not handled
  carefully. Jim needs a voice that stays in the game's sincere-bewilderment tone
  (see CORE_GAME_DESIGN §2.6) — not a winking joke.

Notes:
- Reposition Jim as a **future** Vendor with a unique hook (Buy tab, XP boost
  consumables, or hatch-gated Gym interior) — not the first sell sink.
- Pairs well with **Shop unlock via hatch** above: Jim's Gym is the reward behind
  the broken door.
- Jim's dialogue is an opportunity to reinforce the Clicker lore (Clickers as
  the player's race). He could be a fellow Clicker — a trainer, not a mortal.

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
