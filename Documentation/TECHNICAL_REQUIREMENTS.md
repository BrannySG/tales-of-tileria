# Idle Cursor MMO — Technical Requirements and Architecture Notes

> **Vocabulary note:** [`CONTEXT.md`](../CONTEXT.md) is the canonical glossary
> and wins on any conflict. This document's "Zone" maps to the canonical term
> **Level**, and "zone instance" to **Level instance**. Protocol identifiers
> that embed the old term (e.g. `zone.snapshot`, `ZoneSnapshot`) are kept as-is
> for now to avoid churn; the concept is a Level instance.

## 1. Technical Goal

Build a browser-based prototype of the Idle Cursor MMO that proves the core game loop:

- Cursor-based active clicking
- Passive hover/lock damage
- Entity HP and respawns
- Shared Zone 1 multiplayer state
- Basic quests
- Basic inventory/resources
- NPC reactions
- Modular content definitions

The prototype should be built for fast iteration. Systems should be modular, data-driven, and easy to adjust without large rewrites.

The immediate target is browser/web. Future targets may include mobile, desktop, or Unity, but the prototype should not depend on Unity.

---

## 2. Recommended Prototype Stack

The exact stack can change, but for a fast web prototype:

### Client

- TypeScript
- Vite
- PixiJS, Phaser, or a lightweight custom canvas renderer
- HTML/CSS UI overlay where useful

### Server

For early local prototype:

- Node.js
- WebSocket server
- In-memory zone state

For later hosted prototype:

- Cloudflare Workers with Durable Objects for zone instances
- Cloudflare D1 or KV for persistence where appropriate
- GitHub Pages or Cloudflare Pages for static client hosting

### Why This Direction

The game needs live shared state, so static hosting alone is not enough. The client can be hosted statically, but zone state, player sync, persistence, and anti-cheat validation need a backend.

Durable Objects are a good potential fit later because each shared zone instance can be represented as a single authoritative object managing state and WebSocket connections.

---

## 3. Architecture Principles

### 3.1 Modular Systems

Each major system should be isolated:

- Input System
- Cursor System
- Entity System
- Damage System
- Loot System
- Inventory System
- Skill System
- Quest System
- NPC Dialogue / Reaction System
- Zone System
- Multiplayer Sync System
- UI System
- Persistence System

Systems should communicate through clear events or service interfaces rather than direct hard references where possible.

### 3.2 Data-Driven Content

Entities, quests, loot tables, skills, tools, and zones should be defined in data files.

Recommended format:

- JSON for early simplicity
- TypeScript object definitions if type safety is preferred

Changing Small Rock HP from 15 to 20 should not require touching entity logic.

### 3.3 Authoritative Server for Shared State

For shared zones, the server should be authoritative over:

- Entity HP
- Entity respawn timers
- Entity claims
- Damage validation
- Loot rolls
- Resource rewards
- Player positions/cursors visible to others

The client can predict and display local feedback, but the server should decide final outcomes.

### 3.4 Fast Local Iteration

The project should support:

- Running client locally
- Running server locally
- Hot reloading client content
- Easy content tuning
- Debug tools for spawning entities, resetting quests, adjusting damage, and forcing drops

---

## 4. High-Level Runtime Model

### 4.1 Client Responsibilities

The client handles:

- Rendering the world
- Capturing cursor input
- Showing hover/click/lock feedback
- Sending player actions to server
- Receiving zone state updates
- Displaying UI
- Playing animations and effects
- Showing NPC dialogue
- Maintaining temporary local UI state

### 4.2 Server Responsibilities

The server handles:

- Zone instance lifecycle
- Player connection management
- Shared entity state
- Damage application
- Claim rules
- Respawn timers
- Loot rolls
- Quest progress validation
- Inventory/resource updates
- Broadcasts to connected clients

### 4.3 Persistence Responsibilities

Persistence can be minimal for the first prototype.

Initial persistent data:

- Player ID
- Display name
- Inventory/resources
- Equipped tools
- Skill XP/levels
- Quest states
- Tutorial completion

Data that can remain temporary at first:

- Exact zone entity state
- Active claims
- Player cursor position
- NPC recent reaction cooldowns

---

## 5. Project Structure Proposal

```text
/src
  /client
    /rendering
    /input
    /ui
    /effects
    /network
    /screens
  /server
    /zones
    /network
    /simulation
    /persistence
  /shared
    /types
    /content
    /events
    /utils
  /data
    zones.json
    entities.json
    lootTables.json
    quests.json
    skills.json
    items.json
    npcReactions.json
```

Alternative: keep `/data` inside `/shared/content` if content is imported directly by both client and server.

---

## 6. Core Data Models

### 6.1 Player

```ts
type Player = {
  id: string;
  displayName: string;
  currentZoneId: string;
  cursor: CursorState;
  inventory: InventoryState;
  skills: Record<SkillId, SkillState>;
  equippedTools: EquippedTools;
  quests: Record<QuestId, QuestState>;
};
```

### 6.2 Cursor State

```ts
type CursorState = {
  x: number;
  y: number;
  mode: 'free' | 'hovering' | 'clicking' | 'locked';
  targetEntityId?: string;
  equippedToolId?: string;
};
```

### 6.3 Entity Definition

Static content definition.

```ts
type EntityDefinition = {
  id: string;
  displayName: string;
  type: 'resource' | 'enemy' | 'npc' | 'pickup' | 'craftingStation' | 'questObject' | 'shrine';
  requiredSkill?: SkillRequirement;
  requiredToolType?: ToolType;
  maxHp?: number;
  respawnSeconds?: number;
  lootTableId?: string;
  xpRewards?: Partial<Record<SkillId, number>>;
  interactionRule: 'claimed' | 'sharedContribution' | 'lastHit' | 'personal';
  tags?: string[];
};
```

### 6.4 Entity Instance

Runtime state in a zone.

```ts
type EntityInstance = {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  hp?: number;
  state: 'available' | 'claimed' | 'depleted' | 'respawning' | 'disabled';
  claimedByPlayerId?: string;
  claimExpiresAt?: number;
  respawnAt?: number;
  contributionByPlayerId?: Record<string, number>;
};
```

### 6.5 Loot Table

```ts
type LootTable = {
  id: string;
  rolls: LootRoll[];
};

type LootRoll = {
  itemId: string;
  minQuantity: number;
  maxQuantity: number;
  chance: number;
};
```

### 6.6 Quest

```ts
type QuestDefinition = {
  id: string;
  title: string;
  description: string;
  steps: QuestStep[];
  rewards: QuestReward[];
  prerequisiteQuestIds?: string[];
};
```

---

## 7. Multiplayer Zone Model

### 7.1 Zone Instance

A zone instance contains:

- Zone ID
- Instance ID
- Connected players
- Entity instances
- Local timers
- Event queue
- Recent NPC reaction cooldowns

### 7.2 Zone Capacity

Initial recommendation for Zone 1:

- 4–12 players per instance

Small capacity keeps the zone readable and easier to debug.

### 7.3 Instance Assignment

For prototype:

- Join the first available Zone 1 instance
- Create new instance if current ones are full

Later:

- Party/group matching
- Friends join same instance
- Region-aware instance assignment

---

## 8. Networking Model

### 8.1 Client to Server Events

Examples:

```ts
type ClientEvent =
  | { type: 'cursor.move'; x: number; y: number }
  | { type: 'entity.hoverStart'; entityId: string }
  | { type: 'entity.hoverEnd'; entityId: string }
  | { type: 'entity.click'; entityId: string; toolId?: string }
  | { type: 'entity.lockStart'; entityId: string; toolId?: string }
  | { type: 'entity.lockStop'; entityId: string }
  | { type: 'pickup.collect'; entityId: string }
  | { type: 'npc.interact'; entityId: string }
  | { type: 'craft.request'; recipeId: string }
  | { type: 'quest.accept'; questId: string }
  | { type: 'quest.turnIn'; questId: string };
```

### 8.2 Server to Client Events

Examples:

```ts
type ServerEvent =
  | { type: 'zone.snapshot'; state: ZoneSnapshot }
  | { type: 'zone.patch'; patch: ZonePatch }
  | { type: 'entity.damaged'; entityId: string; hp: number; damage: number; playerId: string }
  | { type: 'entity.depleted'; entityId: string; depletedByPlayerId?: string }
  | { type: 'entity.respawned'; entity: EntityInstance }
  | { type: 'loot.awarded'; items: AwardedItem[] }
  | { type: 'skill.xpGained'; skillId: SkillId; xp: number; newLevel?: number }
  | { type: 'quest.updated'; questState: QuestState }
  | { type: 'npc.reaction'; npcId: string; line: string }
  | { type: 'player.joined'; player: PublicPlayerState }
  | { type: 'player.left'; playerId: string }
  | { type: 'player.cursorUpdated'; playerId: string; cursor: CursorState };
```

### 8.3 Update Frequency

Initial guidance:

- Cursor position updates: throttled, around 10–20 updates per second
- Entity state updates: event-driven where possible
- Full snapshots: on join and occasional reconciliation

Avoid broadcasting every visual-only effect from the server. Some hit sparks, shake effects, and floating numbers can be client-side.

---

## 9. Damage and Interaction Logic

### 9.1 Active Click Damage

Flow:

1. Client sends `entity.click`
2. Server validates target exists
3. Server validates tool requirement
4. Server validates skill requirement
5. Server validates claim rule
6. Server applies damage
7. Server broadcasts result
8. If HP reaches 0, server resolves depletion, loot, XP, quest progress, and respawn timer

### 9.2 Lock Damage

Flow:

1. Client sends `entity.lockStart`
2. Server validates target
3. Server starts lock interaction
4. Server applies damage ticks at a fixed interval
5. If player disconnects, changes target, or loses eligibility, lock stops
6. If entity depletes, loot and respawn resolve

### 9.3 Suggested Tick Rate

For prototype:

- Lock damage tick every 0.5s or 1.0s
- Passive hover damage can be handled similarly or omitted until lock is working

### 9.4 Claim Expiry

For claimed entities:

- Claim starts on first valid click or lock
- Claim expires after a short period without damage input
- Suggested prototype expiry: 3–5 seconds
- Locking refreshes claim automatically while active

---

## 10. Quest System Requirements

### 10.1 Quest State

Each player has independent quest state.

Quest progress should be personal even in shared zones.

Example:

```ts
type QuestState = {
  questId: string;
  status: 'notStarted' | 'active' | 'readyToTurnIn' | 'completed';
  currentStepIndex: number;
  counters: Record<string, number>;
};
```

### 10.2 Quest Events

Quest progress should respond to generic gameplay events:

- `resource.collected`
- `entity.depleted`
- `item.acquired`
- `npc.interacted`
- `craft.completed`
- `zone.entered`

This keeps quests modular and avoids hardcoded quest-specific logic.

### 10.3 Tutorial Quests

The first quests should be implemented using the same quest system as later content. Avoid creating one-off tutorial-only logic unless absolutely necessary.

---

## 11. NPC Reaction System

### 11.1 Purpose

NPC reactions are core to the game’s identity. They should respond to player actions without blocking gameplay too often.

### 11.2 Reaction Triggers

Examples:

- Shack broken
- Axe picked up
- First tree chopped
- First rock mined
- Crafting requested
- Rare drop obtained
- Player idles too long on an entity
- Multiple players farm nearby

### 11.3 Reaction Cooldowns

To prevent annoyance:

- Major quest lines can always play
- Ambient reactions should have cooldowns
- Repeated reactions should rotate through variants
- Some lines should only play once per player

### 11.4 Data Example

```ts
type NpcReaction = {
  id: string;
  npcId: string;
  trigger: string;
  line: string;
  oncePerPlayer?: boolean;
  cooldownSeconds?: number;
  priority?: number;
};
```

---

## 12. Inventory and Resource System

### 12.1 Prototype Scope

Start simple:

- Stackable resources
- Tools as unique items
- Equipped hotbar/tool slots

No need for complex item durability or trading in the first prototype.

### 12.2 Initial Resources

- Wood
- Stone
- Coins

### 12.3 Initial Tools

- Axe
- Pickaxe
- Stone Sword

### 12.4 Item Acquisition Sources

- Quest rewards
- Entity drops
- Crafting
- Pickups

---

## 13. Skill System

### 13.1 Prototype Skills

Start with:

- Woodcutting
- Mining
- Combat

Crafting can be added once resource collection feels good.

### 13.2 XP Gain

XP should be awarded on successful entity depletion, not every click.

This prevents click-spam exploit issues and keeps XP tied to meaningful progress.

### 13.3 Level Requirements

Entity interaction should check:

- Required skill level
- Required tool type
- Optional quest unlock

---

## 14. Rendering and Feel Requirements

### 14.1 Entity Feedback

Entities should respond visibly to interaction:

- Hit flash
- Shake
- Damage number
- HP bar update
- Cracks/chop marks if possible
- Depleted animation
- Respawn poof or fade-in

### 14.2 Cursor Feedback

Cursor should feel like the player’s character.

Possible feedback:

- Equipped tool icon near cursor
- Click impact ring
- Lock-on circle
- Idle tick pulse
- Small name label under cursor
- Other players’ cursors visible with names

### 14.3 UI Layer

Recommended UI:

- Top-left currency
- Left-side quest tracker
- Bottom-center hotbar
- Bottom-left location name
- Hover tooltip near target

---

## 15. Persistence Plan

### 15.1 Local Prototype

Use local storage or simple local server JSON persistence.

### 15.2 Online Prototype

Persist player state using a backend store.

Minimum persistent fields:

- Player ID
- Name
- Inventory
- Equipped tools
- Skill XP
- Quest progress
- Tutorial completion

### 15.3 Authentication

For the earliest prototype:

- Anonymous local identity is acceptable
- Player chooses display name
- Store generated player ID locally

Later:

- Optional accounts
- Discord login
- Platform login

---

## 16. Anti-Cheat and Validation Considerations

Since this is an online progression game, the client should not be trusted for rewards.

Server should validate:

- Entity exists
- Player is close enough if proximity is added later
- Player has required tool
- Player has required skill
- Click rate is within allowed bounds
- Damage numbers are server-calculated
- Loot rolls happen server-side
- Quest rewards are granted server-side

For prototype, anti-cheat can be light, but architecture should avoid trusting client-sent rewards.

---

## 17. Debug and Developer Tools

Fast iteration requires simple debug tools.

Recommended debug actions:

- Reset player progress
- Complete current quest
- Spawn resource node
- Force entity respawn
- Grant item
- Grant XP
- Toggle shared instance view
- Show claim owners
- Show entity IDs
- Show server tick timing
- Force rare drop

Debug tools should be gated behind development mode.

---

## 18. MVP Build Milestones

### Milestone 1: Local Single-Player Interaction

- Render Zone 1
- Cursor movement
- Click small rock
- Entity HP decreases
- Entity breaks and respawns
- Award stone resource

### Milestone 2: Tools and Skills

- Add axe and pickaxe
- Add tree and rock requirements
- Add mining and woodcutting XP
- Add hotbar/equipped tool selection

### Milestone 3: Idle Lock

- Add lock-on interaction
- Passive damage ticks
- Stop lock on target change
- Show lock visual feedback

### Milestone 4: Quest System

- Add first NPC
- Add tutorial quest chain
- Add quest tracker
- Add quest rewards

### Milestone 5: Shared Zone Server

- Add WebSocket server
- Multiple players join same Zone 1
- Other cursors visible
- Entity state synced
- Claims validated server-side

### Milestone 6: NPC Reactions and Crafting Moment

- Add NPC reaction triggers
- Add crafting request prototype
- Materials drop near NPC
- NPC crafts item
- Item appears on shrine for collection

### Milestone 7: Persistence

- Save player name
- Save resources
- Save skills
- Save quest state
- Rejoin with same progress

---

## 19. Major Technical Risks

### 19.1 Shared State Complexity

Entity HP, claims, respawns, and loot must be server-authoritative to avoid bugs and cheating.

Mitigation:

- Keep initial entity count low
- Keep Zone 1 small
- Use simple event-driven patches

### 19.2 UI and World Clutter

Many entities and players can quickly make the scene unreadable.

Mitigation:

- Limit zone capacity
- Hide detailed info until hover
- Keep HP bars contextual
- Use small nameplates

### 19.3 Tutorial and Shared Zone Conflict

Scripted tutorial events can conflict with shared multiplayer spaces.

Mitigation:

- Tutorial intro can be private
- Transition player into shared Zone 1 after first scripted moment
- Alternatively, make tutorial shack personal while the rest of the zone is shared

### 19.4 Content Hardcoding

Fast prototypes often become hardcoded and difficult to expand.

Mitigation:

- Use data definitions from the start
- Avoid hardcoding specific quest IDs inside core systems
- Use generic event triggers

### 19.5 Idle Abuse

Players may attempt to keep locks active forever or farm resources unfairly.

Mitigation:

- Respawn timers
- Claim expiry
- Server-side lock validation
- Rate-limited damage ticks
- Future: fatigue, tool energy, or diminishing returns if needed

---

## 20. Immediate Implementation Priorities

The first implementation should not attempt to build the whole game.

Priority order:

1. Render the mockup-style Zone 1
2. Click-to-damage one rock
3. Break rock and respawn it
4. Award stone
5. Add tree and axe requirement
6. Add pickaxe requirement
7. Add idle lock
8. Add first quest tracker
9. Add NPC dialogue reaction
10. Add shared multiplayer state

The prototype is successful if the player can join a small shared grassy zone, see other cursors, click and lock onto rocks/trees, gather resources, complete the first quest, and see NPCs react to their divine cursor actions.
