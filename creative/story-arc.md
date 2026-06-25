# Story Arc — The Clickers, the Awakening, and Rebirth

> **Status: exploratory creative lore — NOT canonical.**
> This is a scratch space for the wide story we want to tell. It is ideas in
> progress, not a spec and not a decision. Canon vocabulary lives in
> [`CONTEXT.md`](../CONTEXT.md); accepted decisions live in
> [`docs/adr/`](../docs/adr/README.md); design lives in
> [`Documentation/CORE_GAME_DESIGN.md`](../Documentation/CORE_GAME_DESIGN.md).
> If/when a beat here gets locked in, it graduates into `CONTEXT.md` (vocab) and
> an ADR (decision) — don't treat anything below as settled.

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

Once they reach a certain power level, they'll reach a story telling moment that
basically sucks them out of the simulation they're in — lab coat clickers,
etc... It will be an "awakening" moment of some kind.

### The Council boss fight

The player might fight one of the council members from the Council of Clickers.
This will be an epic boss fight of some kind. (Throughout the game, each council
member progressively stronger, different fight style, etc...)

THEN, upon finishing the fight something happens, and we hear chatter about "we
have to make the simulation better, it's working better than we expected..."
style moments.

### Rebirth

The player reawakens at the start of the game. We'll make things different,
maybe allow them to keep a large portion of their power.

It would be cool if a "rebirth" forced the player to mark a skill as **eternal**.
Allowing them to keep all of their progression related to that skill.

Then, every time a player rebirths, they mark a new skill as eternal until they
slowly have every skill eternal.

This would feel awesome! (I think!)

### The Reawaken skill tree

We'd also then give a ton of rewards and power in a whole new **reawaken skill
tree** to help the player progress faster.

Each reawaken would be a new "make the simulation stronger" moment, allowing us
to then add entire new zones to the world, new content, mechanics etc... All
neatly gated behind this progression system.

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
  is a *new* meta layer. It rhymes with the existing **Clicker meta-track**
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
  "different fight style per member" scale across reawakens?
