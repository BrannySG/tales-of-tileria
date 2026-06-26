import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RARITIES,
  cursorSkinTextureId,
  getItemDefinition,
  getToolDefinition,
  resolveSellValue,
  sellSkillFor,
  sellValueFor,
  vendorStock,
  type ItemDefinition,
  type Rarity,
  type SellMode,
  type SimTransport,
  type ToolId,
} from '@tot/shared';
import { ASSET_URL } from '../assets/manifest';
import { useHud } from '../state/store';
import { RARITY_COLOR } from './rarityColor';
import { skillLabel } from './skillPresentation';
import { pickLine, type VendorProfile } from '../content/vendorDialogue';

/** Rarities that prompt a confirm before selling (a Collection-worthy drop). */
const CONFIRM_RARITIES: ReadonlySet<Rarity> = new Set<Rarity>(['epic', 'legendary']);
/** How often the idle vendor barks a new ambient line (ms). */
const IDLE_BARK_MS = 9000;
/** How long a spoken line lingers before the vendor falls quiet (ms). */
const LINE_HOLD_MS = 5200;

interface SellableStack {
  def: ItemDefinition;
  count: number;
}

/** Inventory stacks that can be sold, sorted by rarity then name (Gold excluded). */
function sellableStacks(inventory: Record<string, number>): SellableStack[] {
  const stacks: SellableStack[] = [];
  for (const [id, count] of Object.entries(inventory)) {
    if (count <= 0) continue;
    const def = getItemDefinition(id);
    if (!def || def.category === 'currency') continue;
    if (!sellValueFor(id)) continue;
    stacks.push({ def, count });
  }
  return stacks.sort((a, b) => {
    const r = RARITIES.indexOf(a.def.rarity) - RARITIES.indexOf(b.def.rarity);
    if (r !== 0) return r;
    return a.def.displayName.localeCompare(b.def.displayName);
  });
}

/**
 * The Vendor scene (see CONTEXT.md: Shop, Vendor; ADR-0027): a dedicated
 * full-screen "conversation" surface. The vendor's Cursor-skin portrait bobs and
 * speaks Clicker-lore lines on the left; the Sell tab (Gold/XP toggle) and a
 * deferred Buy tab sit on the right. Selling is sim-authoritative — the scene
 * only sends `item.sell` and projects the resulting `shop.sold` events for the
 * running tally + reaction lines; inventory/Gold/XP flow through the HUD store.
 */
export function VendorScene({
  profile,
  transport,
  onClose,
}: {
  profile: VendorProfile;
  transport: SimTransport;
  onClose: () => void;
}) {
  const inventory = useHud((s) => s.inventory);
  const ownedToolIds = useHud((s) => s.ownedToolIds);
  const equippedBySlot = useHud((s) => s.equippedBySlot);
  // Buy vendors (an Equipment stall) open on the Buy tab; sell-only vendors on Sell.
  const [tab, setTab] = useState<'sell' | 'buy'>(profile.buyStockId ? 'buy' : 'sell');
  const [mode, setMode] = useState<SellMode>('gold');
  const [line, setLine] = useState<string>(() => pickLine(profile.dialogue.greet));
  const [confirm, setConfirm] = useState<{ itemId: string; quantity: number } | null>(null);
  // Running session tally of what this visit has yielded (client-only, ephemeral).
  const [tally, setTally] = useState<{ gold: number; xp: number }>({ gold: 0, xp: 0 });
  const lineTimer = useRef<number | undefined>(undefined);

  const portraitTexture = ASSET_URL[cursorSkinTextureId(profile.skinId)];
  const gold = inventory.gold ?? 0;
  const stacks = useMemo(() => sellableStacks(inventory), [inventory]);

  // Speak a line and auto-quiet after a hold (the portrait bobs continuously).
  const speak = (text: string) => {
    if (!text) return;
    setLine(text);
    window.clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine(''), LINE_HOLD_MS);
  };

  // Project trades: drive reaction lines + the running tally from the
  // authoritative `shop.sold`/`shop.bought` events (presentation, never mutates).
  useEffect(() => {
    const unsub = transport.subscribe((event) => {
      if (event.type === 'shop.sold') {
        setTally((t) => ({
          gold: t.gold + (event.goldGained ?? 0),
          xp: t.xp + (event.xpGained ?? 0),
        }));
        const def = getItemDefinition(event.itemId);
        const rare = def ? CONFIRM_RARITIES.has(def.rarity) : false;
        speak(pickLine(rare ? profile.dialogue.onSellRare : profile.dialogue.onSell));
      } else if (event.type === 'shop.bought') {
        speak(pickLine(profile.dialogue.onBuy ?? profile.dialogue.onSell));
      }
    });
    return unsub;
    // `profile` is stable for the scene's lifetime, so [transport] is enough.
  }, [transport]);

  // Ambient lore barks on a timer while the scene is open (skips while a line is
  // already showing so reaction lines aren't trampled).
  useEffect(() => {
    const id = window.setInterval(() => {
      setLine((current) => {
        if (current) return current;
        const next = pickLine(profile.dialogue.idle);
        if (next) {
          window.clearTimeout(lineTimer.current);
          lineTimer.current = window.setTimeout(() => setLine(''), LINE_HOLD_MS);
        }
        return next;
      });
    }, IDLE_BARK_MS);
    return () => window.clearInterval(id);
  }, [profile]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(lineTimer.current);
    };
  }, [onClose]);

  const sell = (itemId: string, quantity: number) => {
    if (quantity <= 0) return;
    transport.send({ type: 'item.sell', itemId, quantity, mode });
  };

  const buy = (equipmentId: ToolId) => {
    if (!profile.buyStockId) return;
    transport.send({ type: 'item.buy', equipmentId, vendorId: profile.buyStockId });
  };

  // The Buy stock for this Vendor (empty for sell-only vendors).
  const stock = profile.buyStockId ? vendorStock(profile.buyStockId) : [];

  const requestSell = (def: ItemDefinition, quantity: number) => {
    if (quantity <= 0) return;
    if (CONFIRM_RARITIES.has(def.rarity)) {
      setConfirm({ itemId: def.id, quantity });
      return;
    }
    sell(def.id, quantity);
  };

  const sellAllStacks = () => {
    // Sell every stack whose value is resolvable in the current mode; the
    // per-item confirm is skipped here intentionally (it's an explicit bulk act).
    for (const { def, count } of stacks) {
      if (resolveSellValue(def.id, mode) !== null) sell(def.id, count);
    }
  };

  const confirmDef = confirm ? getItemDefinition(confirm.itemId) : undefined;
  const unitLabel = mode === 'gold' ? 'Gold' : 'XP';

  return (
    <div className="vendor-scene" role="dialog" aria-modal="true" aria-label={`${profile.displayName} — Black Market`}>
      <div className="vendor-scene-backdrop" onClick={onClose} />

      <div className="vendor-scene-body">
        {/* Left: the vendor portrait + speech */}
        <div className="vendor-stage">
          <div key={line} className="vendor-speech" data-empty={line ? undefined : 'true'}>
            {line}
          </div>
          <div className="vendor-portrait">
            {portraitTexture ? (
              <img src={portraitTexture} alt={profile.displayName} draggable={false} />
            ) : (
              <div className="vendor-portrait-fallback" aria-hidden />
            )}
          </div>
          <div className="vendor-name">{profile.displayName}</div>
          <div className="vendor-subtitle">{profile.subtitle ?? 'Black Market'}</div>
        </div>

        {/* Right: the trade panel */}
        <div className="vendor-panel">
          <div className="vendor-panel-head">
            <div className="vendor-tabs">
              <button
                className={`vendor-tab ${tab === 'sell' ? 'active' : ''}`}
                onClick={() => setTab('sell')}
              >
                Sell
              </button>
              <button
                className={`vendor-tab ${tab === 'buy' ? 'active' : ''}`}
                onClick={() => setTab('buy')}
              >
                Buy
              </button>
            </div>
            <div className="vendor-gold" title="Your Gold">
              <span className="vendor-gold-coin" aria-hidden />
              {gold.toLocaleString()}
            </div>
            <button className="vendor-close" onClick={onClose} aria-label="Leave">
              ✕
            </button>
          </div>

          {tab === 'sell' ? (
            <div className="vendor-sell">
              <div className="vendor-mode">
                <span className="vendor-mode-label">Sell for</span>
                <div className="vendor-mode-toggle" role="group" aria-label="Sell mode">
                  <button
                    className={`vendor-mode-btn ${mode === 'gold' ? 'active' : ''}`}
                    onClick={() => setMode('gold')}
                  >
                    Gold
                  </button>
                  <button
                    className={`vendor-mode-btn ${mode === 'xp' ? 'active' : ''}`}
                    onClick={() => setMode('xp')}
                  >
                    XP
                  </button>
                </div>
              </div>

              <div className="vendor-list">
                {stacks.length === 0 && (
                  <div className="vendor-empty">Nothing to sell. Go gather, divine one.</div>
                )}
                {stacks.map(({ def, count }) => {
                  const unit = resolveSellValue(def.id, mode);
                  const skillId = sellSkillFor(def.id);
                  const goldOnly = mode === 'xp' && unit === null;
                  return (
                    <div className={`vendor-row ${goldOnly ? 'disabled' : ''}`} key={def.id}>
                      <div className="vendor-row-icon" style={{ borderColor: RARITY_COLOR[def.rarity] }}>
                        {def.worldTextureId && ASSET_URL[def.worldTextureId] && (
                          <img src={ASSET_URL[def.worldTextureId]} alt={def.displayName} />
                        )}
                        <span className="vendor-row-count">{count}</span>
                      </div>
                      <div className="vendor-row-info">
                        <span className="vendor-row-name" style={{ color: RARITY_COLOR[def.rarity] }}>
                          {def.displayName}
                        </span>
                        <span className="vendor-row-value">
                          {goldOnly ? (
                            'Gold only'
                          ) : (
                            <>
                              {unit} {unitLabel} each
                              {mode === 'xp' && skillId ? ` · ${skillLabel(skillId)}` : ''}
                            </>
                          )}
                        </span>
                      </div>
                      <div className="vendor-row-actions">
                        <button
                          className="vendor-btn"
                          disabled={goldOnly}
                          onClick={() => requestSell(def, 1)}
                        >
                          Sell 1
                        </button>
                        <button
                          className="vendor-btn primary"
                          disabled={goldOnly}
                          onClick={() => requestSell(def, count)}
                        >
                          Sell all
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="vendor-footer">
                <div className="vendor-tally">
                  This visit: <strong>{tally.gold.toLocaleString()}</strong> Gold ·{' '}
                  <strong>{tally.xp.toLocaleString()}</strong> XP
                </div>
                <button className="vendor-btn ghost" disabled={stacks.length === 0} onClick={sellAllStacks}>
                  Sell everything
                </button>
              </div>
            </div>
          ) : stock.length === 0 ? (
            <div className="vendor-buy">
              <div className="vendor-buy-soon">
                <span className="vendor-buy-soon-title">Wares coming soon</span>
                <p>
                  &ldquo;Equipment? I&rsquo;m still... acquiring stock. Sell to me for now, and
                  come back when the shelves are full.&rdquo;
                </p>
              </div>
            </div>
          ) : (
            <div className="vendor-sell">
              <div className="vendor-list">
                {stock.map(({ equipmentId, goldCost }) => {
                  const def = getToolDefinition(equipmentId);
                  if (!def) return null;
                  const owned = ownedToolIds.includes(equipmentId);
                  const equipped = equippedBySlot[def.toolType] === equipmentId;
                  const tooPoor = gold < goldCost;
                  const status = equipped ? 'Equipped' : owned ? 'Owned' : null;
                  return (
                    <div className={`vendor-row ${owned ? 'disabled' : ''}`} key={equipmentId}>
                      <div className="vendor-row-icon">
                        {ASSET_URL[def.iconTextureId] && (
                          <img src={ASSET_URL[def.iconTextureId]} alt={def.displayName} />
                        )}
                      </div>
                      <div className="vendor-row-info">
                        <span className="vendor-row-name">{def.displayName}</span>
                        <span className="vendor-row-value">
                          {status ?? `${goldCost.toLocaleString()} Gold`}
                        </span>
                      </div>
                      <div className="vendor-row-actions">
                        <button
                          className="vendor-btn primary"
                          disabled={owned || tooPoor}
                          onClick={() => buy(equipmentId)}
                        >
                          {owned ? 'Owned' : tooPoor ? 'Too pricey' : 'Buy'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="vendor-footer">
                <div className="vendor-tally">
                  Buy gear, then equip it from your Bag to gain its power.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirm && confirmDef && (
        <div className="vendor-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="vendor-confirm" onClick={(e) => e.stopPropagation()}>
            <p>
              Sell <strong style={{ color: RARITY_COLOR[confirmDef.rarity] }}>
                {confirm.quantity}× {confirmDef.displayName}
              </strong>{' '}
              for {(resolveSellValue(confirmDef.id, mode) ?? 0) * confirm.quantity} {unitLabel}?
            </p>
            <p className="vendor-confirm-hint">This {confirmDef.rarity} item may be worth more in a Collection.</p>
            <div className="vendor-confirm-actions">
              <button className="vendor-btn ghost" onClick={() => setConfirm(null)}>
                Keep it
              </button>
              <button
                className="vendor-btn primary"
                onClick={() => {
                  sell(confirm.itemId, confirm.quantity);
                  setConfirm(null);
                }}
              >
                Sell
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
