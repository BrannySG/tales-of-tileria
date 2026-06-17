import { useEffect, useState } from 'react';
import { getItemDefinition, getToolDefinition, listRecipeDefinitions } from '@tot/shared';
import { useHud } from '../state/store';
import { ASSET_URL } from '../assets/manifest';

/**
 * The crafting menu (see ADR-0010): a modal listing recipes, each with its cost
 * checked against the live inventory. Crafting is sim-authoritative — selecting
 * a recipe sends `craft.start`; the in-flight job (and its progress) is mirrored
 * from sim events, and the crafted item is then claimed from the Shrine.
 */
export function CraftingMenu({
  onCraft,
  onClose,
}: {
  onCraft: (recipeId: string) => void;
  onClose: () => void;
}) {
  const inventory = useHud((s) => s.inventory);
  const job = useHud((s) => s.craftingJob);
  const recipes = listRecipeDefinitions();
  const [progress, setProgress] = useState(0);

  // Animate the in-flight job's progress locally from its start time.
  useEffect(() => {
    if (!job) {
      setProgress(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - job.startedAt) / 1000;
      setProgress(Math.min(1, elapsed / job.totalSeconds));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [job]);

  return (
    <div className="craft-overlay" onClick={onClose}>
      <div className="craft-panel" onClick={(e) => e.stopPropagation()}>
        <div className="craft-header">
          <span>Crafting</span>
          <button className="craft-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="craft-list">
          {recipes.map((recipe) => {
            const affordable = recipe.cost.every((c) => (inventory[c.itemId] ?? 0) >= c.quantity);
            const busy = job?.recipeId === recipe.id;
            const tool = getToolDefinition(recipe.result.grantsToolId);
            const resultIcon = tool ? ASSET_URL[tool.iconTextureId] : undefined;
            return (
              <div key={recipe.id} className={`craft-recipe ${busy ? 'busy' : ''}`}>
                <div className="craft-recipe-icon">
                  {resultIcon && <img src={resultIcon} alt="" aria-hidden />}
                </div>
                <div className="craft-recipe-main">
                  <div className="craft-recipe-title">{recipe.displayName}</div>
                  <div className="craft-cost">
                    {recipe.cost.map((c) => {
                      const have = inventory[c.itemId] ?? 0;
                      const itemDef = getItemDefinition(c.itemId);
                      const icon = itemDef?.worldTextureId
                        ? ASSET_URL[itemDef.worldTextureId]
                        : undefined;
                      return (
                        <span
                          key={c.itemId}
                          className={`craft-cost-item ${have >= c.quantity ? 'ok' : 'lack'}`}
                          title={itemDef?.displayName ?? c.itemId}
                        >
                          {icon && <img src={icon} alt="" aria-hidden />}
                          {have}/{c.quantity}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="craft-recipe-action">
                  {busy ? (
                    <div className="craft-progress">
                      <div
                        className="craft-progress-fill"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                      <span className="craft-progress-label">Crafting…</span>
                    </div>
                  ) : (
                    <button
                      className="craft-button"
                      disabled={!affordable || Boolean(job)}
                      onClick={() => onCraft(recipe.id)}
                    >
                      {affordable ? 'Craft' : 'Need more'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="craft-hint">Crafted items appear on the Shrine — collect them there.</p>
      </div>
    </div>
  );
}
