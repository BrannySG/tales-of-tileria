# Story Arc — The Clickers, the Awakening, and Rebirth

> **Status: exploratory creative lore — NOT canonical.**
> This is a scratch space for the wide story we want to tell. It is ideas in
> progress, not a spec and not a decision. Canon vocabulary lives in
> [`CONTEXT.md`](../CONTEXT.md); accepted decisions live in
> [`docs/adr/`](../docs/adr/README.md); design lives in
> [`Documentation/CORE_GAME_DESIGN.md`](../Documentation/CORE_GAME_DESIGN.md).
> If/when a beat here gets locked in, it graduates into `CONTEXT.md` (vocab) and
> an ADR (decision) — don't treat anything below as settled.
>
> **Priority ratings and reviews are maintained per the
> [creative docs protocol](../.cursor/rules/creative-docs.mdc).
> Re-review every item when this doc is updated.**
>
> Last reviewed: 2026-06-25 *(doc-cleanup pass: deduped the "cursor boss fight" question; ratings re-confirmed)*

---

## The boot screen — "Wake up"

> **Priority: HIGH**
> Impact: Every player sees this on every session start. Sets tone and plants the
> simulation mystery with zero gameplay disruption.

Every time you load the game there should be a white, angelic-style white
screen. Then we see a silhouette of a Clicker approaching — almost from a
first-person perspective — and it subtly reveals as a Clicker dressed as a
scientist: glasses and everything (a super cool skin essentially).

> "Wake up"

Then a vintage TV-style fade as the game fades into being.

As a storytelling moment: every time you start the game you're being put *into*
the simulation. Players won't understand that at first — that's the point. The
meaning can be threaded over tons of hours of gameplay so the reveal slowly
arrives over development. Should make for a banger story.

Ties nicely into the Reawaken mechanics. A really nice little "for those that
know" moment for players who've been through a rebirth.

**Review**

Pros:
- Highest player-touch frequency of any story beat — every session, every
  player. The emotional tone investment is enormous relative to implementation
  cost.
- Ships mystery before the payoff exists. The boot screen has value even with
  zero arc built: it creates intrigue immediately.
- The scientist Clicker is a natural candidate for a real cursor skin. Design
  the boot screen character and a cosmetic unlock at the same time.
- The vintage TV fade is a strong stylistic signature — already distinctive
  before players know why it matters.
- Layered meaning on rebirth: returning players who've seen the arc will have
  a completely different read of the same screen. Great design.

Cons / risks:
- "Wake up" only lands as a narrative moment if the simulation reveal arc gets
  built eventually. If the arc is never built, the boot screen is pleasant
  flavour but not the "banger reveal" intended.
- Every-session playback could become skippable noise if it isn't very short.
  Must be 2–3 seconds maximum or players will click-through it anyway.
- The full-screen white flash needs to be brightness-capped for accessibility
  (photosensitivity considerations).

Notes:
- Can ship a simplified version early: white screen, silhouette, "Wake up",
  TV-style fade, done. The full detail (scientist reveal animation) can come
  later.
- Keep it under 3 seconds. Make it skippable by tap/click from frame 1.
- The scientist Clicker skin should be noted as a companion cosmetic to design.

---

## The Clickers

The Clickers (the player's race) are a god-like race. They exist in the same
universe as the inhabitants of Tileria (our game world) but they are more like
observers.

They watch over the world and have found ways to interact with the human world.

They are a very technically capable race.

---

## The big, wide story

There's a big, wide story we can make here.

The Clickers will be farming the human world for resources and fuel. Our main
character will secretly be tasked with farming resources and be within a
"training program" fabricated by the Council of Clickers.

The player (via gameplay) will grow stronger and stronger, farming more and more
resources.

### The Awakening

> **Priority: LONG-TERM**
> Impact: The payoff for the entire simulation framing. Cannot ship without
> significant content depth and the boss fight system.

Once they reach a certain power level, they'll reach a story telling moment that
basically sucks them out of the simulation they're in — lab coat clickers,
etc... It will be an "awakening" moment of some kind.

**Review**

Pros:
- The "pulled out of the simulation" beat is genuinely novel and could be a
  memorable industry moment if executed well. Most prestige games just show a
  numbers screen.
- Ties directly to the boot screen — the payoff for players who connected the
  dots over tens of hours.
- The Council of Clickers Level already exists in the codebase (authored, parked
  behind `ONBOARDING_VARIANT: 'arc'`) — the Awakening scene could reuse or extend
  that Level rather than building from scratch.

Cons / risks:
- Requires the core loop to be deep enough that "reaching a power threshold"
  takes meaningful play time. Ship this too early and it's a tutorial end screen.
- The "lab coat Clickers" visual needs art direction that fits the cursor aesthetic.
  Risk of tonal inconsistency if not designed carefully.
- No boss combat system exists yet. The Awakening likely precedes or triggers the
  first Council fight — that system is a prerequisite.

Notes:
- Document the story beats in detail now. Build toward it incrementally.
- The power threshold trigger is a clean design gate: set it high enough that
  players feel genuinely powerful before it fires.
- The existing Council Level (`council_01`) and `CouncilDirector` are the
  foundation. Re-read ADR-0013 when designing this beat.

---

### The Council boss fight

> **Priority: LONG-TERM**
> Impact: The game's primary endgame engagement loop — but requires a combat
> system that does not exist yet.

The player might fight one of the council members from the Council of Clickers.
This will be an epic boss fight of some kind. (Throughout the game, each council
member progressively stronger, different fight style, etc...)

THEN, upon finishing the fight something happens, and we hear chatter about "we
have to make the simulation better, it's working better than we expected..."
style moments.

**Review**

Pros:
- Progressively harder Council members (different fight style per member) is
  an elegant endgame structure: each rebirth unlocks the next member, scaling
  infinitely with content additions.
- The post-fight "make the simulation better" chatter is brilliant narrative
  scaffolding. Every new content update — new zones, mechanics — is explained
  in-fiction as the Clickers upgrading the sim. This gives us a perpetual,
  lore-consistent reason to add content.
- Boss fights are high-engagement, high-retention events in every comparable
  game (Melvor, RS bosses, etc.).

Cons / risks:
- The cursor is the player's only physical presence. A "boss fight" needs a
  combat model that fits the cursor interaction model — this is a significant
  design problem. What does "fighting" a Council member look like for a cursor?
- Each Council member needing a distinct fight style multiplies art and system
  work per fight. The first one sets the bar for all subsequent fights.
- This is gated behind: rebirth system, combat system, Council Level expansion,
  and enough base content to make reaching the fight feel earned.

Notes:
- The core design question: what is a "boss fight" in cursor-click terms?
  Options: a timed DPS check? a pattern-avoidance mechanic? a resource-spending
  phase? Answer this before any boss is built.
- Start with one Council member, one fight style. Iterate from there.

---

### Rebirth

> **Priority: LONG-TERM (design now, build after first Awakening ships)**
> Impact: The structural backbone of the entire long-term progression loop.

The player reawakens at the start of the game. We'll make things different,
maybe allow them to keep a large portion of their power.

It would be cool if a "rebirth" forced the player to mark a skill as **eternal**.
Allowing them to keep all of their progression related to that skill.

Then, every time a player rebirths, they mark a new skill as eternal until they
slowly have every skill eternal.

This would feel awesome! (I think!)

**Review**

Pros:
- "Mark one skill eternal per rebirth" is mechanically elegant and novel. It
  avoids the classic prestige-game problem of feeling like you've lost everything.
  Players have a clear, permanent trophy from every loop.
- The arc toward "all skills eternal" gives a concrete, long-term finish line
  visible from the first rebirth. Powerful motivation.
- Fits the simulation framing perfectly: the Clickers let you keep what they've
  "learned" about you.
- Pairs naturally with the Clicker meta-track (ADR-0024): Clicker level and
  Idle Mode progression could survive rebirth as part of the "eternal" model.

Cons / risks:
- Soft resets are contentious. Players who have invested tens of hours need a
  generous power-carry and a very clear value proposition for why to rebirth.
- "Eternal" skill selection is a permanent choice (or should it be?). Players
  will regret bad choices. The selection UX needs to be exceptional — a ritual
  moment, not a dropdown.
- Rebirth resets create content pacing challenges: what does a re-run of the
  early game feel like when you're carrying power? Balance is hard.
- The Clicker meta-track naming (see open questions below) must be resolved
  before building the rebirth layer.

Notes:
- Prototype the first rebirth before designing the nth rebirth. The feel of
  the first reset is everything.
- "Eternal" should feel ceremonial. Consider a dedicated ritual UI beat, not
  a settings screen.
- Check: should Clicker level / Idle Mode survive rebirth automatically? This
  is a meaningful design call — idle breadth reward probably should survive.

---

### The Reawaken skill tree

> **Priority: LONG-TERM (post-rebirth prototype)**
> Impact: Post-prestige power escalation and content-gating system.

We'd also then give a ton of rewards and power in a whole new **reawaken skill
tree** to help the player progress faster.

Each reawaken would be a new "make the simulation stronger" moment, allowing us
to then add entire new zones to the world, new content, mechanics etc... All
neatly gated behind this progression system.

**Review**

Pros:
- Reawaken-gated content is the cleanest model for adding new zones/mechanics
  without breaking existing players. Each update has a natural delivery vehicle.
- A dedicated reawaken tree (separate from the Skill Trees and Clicker tree)
  gives us a third meta-layer of progression: Skill Trees (per-skill), Clicker
  track (breadth), Reawaken track (prestige depth).
- "Make the simulation stronger" as the in-fiction justification for new content
  is brilliant. It turns the developer roadmap into a lore event.

Cons / risks:
- Three meta-layers of trees is complex. Players need to understand which tree
  does what without a reference guide. Naming and UI separation are critical.
- Dependent on rebirth being built and proven fun first. Designing the reawaken
  tree before players have experienced rebirth is premature.
- Power inflation risk: if the reawaken tree hands out too much power, the early
  game loop on subsequent runs becomes trivial.

Notes:
- Design after the first rebirth prototype is playtested. Not before.
- The Clicker tree (ADR-0024) is the closest existing analogue. Reawaken tree
  should be architecturally parallel (same node/rank/allocation machinery) but
  separate in presentation and progression scope.
- Reconcile the "Clickers" (race) vs "Clicker" (meta-track) naming before this
  layer is built — the reawaken tree will surface all three concepts to players.

---

## Why this works

There's some lore to figure out there, but the core story arc supports the types
of gameplay we want to support really nicely, and the new systems we're
introducing will be super cool as a general wrapper for the game.

---

## How this ties into existing canon

These are cross-references, not redefinitions — the linked docs win on any
conflict.

- **Clicker**, **Council of Clickers**, **Banishment**, and **Cursor-being**
  already exist in [`CONTEXT.md`](../CONTEXT.md) and
  [ADR-0013](../docs/adr/0013-council-of-clickers-is-an-authored-level.md)
  (the Council as an authored Level of Cursor-being entities, with the
  Banishment as a real sim command). This arc extends those — the "training
  program" framing and the boss fight build on the same celestial cast.
  - Note: in current canon **Clicker** is also the name of the idle meta-track
    (`'clicker'` `TreeId`, see below), distinct from "Clickers, the race." The
    naming overlap is a thread to resolve before anything is locked in.
- The **rebirth / reawaken** meta-progression (eternal skills + a reawaken tree)
  is a new meta layer. It rhymes with the existing **Clicker meta-track**
  ([ADR-0024](../docs/adr/0024-idle-mode-and-clicker-meta-track.md)), which
  already reuses the Skill Tree machinery for a non-Skill tree keyed
  `'clicker'`. Treat the reawaken tree as a future meta layer to reconcile with
  (or build alongside) that track, not a redefinition of it.
- **Skills**, **Skill Trees**, and progression already exist in `CONTEXT.md`;
  "marking a skill as eternal" would be a new modifier on existing Skill state.

---

## Open lore questions

Threads still to figure out:

- Naming collision: "Clickers" (the race) vs the existing "Clicker" meta-track.
  Do we rename one, or lean into the connection?
- What exactly is the human world's relationship to Tileria — is Tileria the
  simulation, the real human world, or a layer between?
- What is the resource/fuel being farmed *for*, from the Clickers' point of view?
- Is the first Awakening a one-time scripted beat or the first of a repeatable
  rebirth cycle from day one?
- How much power is kept on rebirth, and how is "eternal" surfaced to the player
  (a choice screen? a ritual?)?
- How do new zones unlock per reawaken — strictly gated, or soft-gated by power?
- Where do the council boss fights live (authored Levels?) and how does the
  "different fight style per member" scale across reawakens? (The "what *is* a
  cursor boss fight" question lives in the **Council boss fight** section's Notes
  above — not repeated here.)
- Does the Clicker track (ADR-0024) survive rebirth automatically, or must it be
  earned as eternal like a Skill?
