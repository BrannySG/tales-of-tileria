import { useState } from 'react';
import { InventoryMock } from '../ui/lab/InventoryMock';
import { SKINS } from '../ui/lab/skins';

/**
 * UI LAB (research spike, dev-only #/ui-lab) — side-by-side comparison of the
 * inventory mockup rendered with a pre-made Synty frame vs a GenAI-generated
 * wooden frame, both driven by the same `InventoryMock` + `Frame` primitives.
 *
 * Not shipped, not wired to the sim. See the lab writeup for findings.
 */

const SIZES = [320, 360, 460] as const;

export function UiLabMode() {
  const [width, setWidth] = useState<number>(360);

  return (
    <div className="ui-lab">
      <header className="ui-lab-bar">
        <div>
          <h1>UI Frame Lab</h1>
          <p>One inventory renderer, two skins. Resize to stress-test 9-slice scaling.</p>
        </div>
        <div className="ui-lab-sizes">
          {SIZES.map((s) => (
            <button key={s} className={s === width ? 'is-active' : ''} onClick={() => setWidth(s)}>
              {s}px
            </button>
          ))}
        </div>
      </header>

      <div className="ui-lab-stage">
        {SKINS.map((skin) => (
          <figure key={skin.id} className="ui-lab-cell">
            <InventoryMock skin={skin} width={width} />
            <figcaption>
              <strong>{skin.label}</strong>
              <span>{skin.source}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
