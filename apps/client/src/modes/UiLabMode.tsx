import { useState } from 'react';
import { LabPanel } from '../ui/lab/LabPanel';
import { DEFAULT_NOTIFICATIONS, MOCK_PROFILE, type LabNotifications } from '../ui/lab/mockData';
import { PIPELINE_SKIN } from '../ui/lab/skins';
import { ProfileCard } from '../ui/Hud';

/**
 * UI LAB (research spike, dev-only #/ui-lab) — an interactive previewer for the
 * panel's five sections (Bag, Equipment, Skills, Collections, Settings). One
 * framed panel with the detached wood tab bar; click a tab to preview its
 * content. Width + Touch/PC density toggles stress ergonomics; the Notifications
 * toggles flip the mock red-dot state so tab- and row-level dots can be previewed.
 *
 * Not shipped, not wired to the sim. See the lab writeup for findings.
 */

const WIDTHS = [320, 400, 480] as const;
type Density = 'touch' | 'pc';

/** Tab-level dot toggles (Skills derives its dot from skill state + level-ups). */
const NOTIF_TOGGLES: { key: keyof Omit<LabNotifications, 'skillLevelUps'>; label: string }[] = [
  { key: 'bag', label: 'Bag' },
  { key: 'equipment', label: 'Equip' },
  { key: 'collections', label: 'Collections' },
  { key: 'settings', label: 'Settings' },
];

export function UiLabMode() {
  const [width, setWidth] = useState<number>(400);
  const [density, setDensity] = useState<Density>('pc');
  const [notifications, setNotifications] = useState<LabNotifications>(DEFAULT_NOTIFICATIONS);
  const [profileNew, setProfileNew] = useState(true);
  const [profileRegion, setProfileRegion] = useState(true);

  const profileVM = {
    ...MOCK_PROFILE,
    hasNew: profileNew,
    regionName: profileRegion ? MOCK_PROFILE.regionName : undefined,
  };

  const toggle = (key: keyof Omit<LabNotifications, 'skillLevelUps'>) =>
    setNotifications((n) => ({ ...n, [key]: !n[key] }));

  const skillLevelUpOn = notifications.skillLevelUps.length > 0;
  const toggleSkillLevelUp = () =>
    setNotifications((n) => ({ ...n, skillLevelUps: skillLevelUpOn ? [] : ['woodcutting'] }));

  return (
    <div className={`ui-lab is-${density}`}>
      <header className="ui-lab-bar">
        <div>
          <h1>UI Tab Lab</h1>
          <p>Tab previewer: click a tab to preview each section. Toggle notification dots below.</p>
        </div>
        <div className="ui-lab-controls">
          <div className="ui-lab-sizes" role="group" aria-label="Panel width">
            {WIDTHS.map((s) => (
              <button key={s} className={s === width ? 'is-active' : ''} onClick={() => setWidth(s)}>
                {s}px
              </button>
            ))}
          </div>
          <div className="ui-lab-sizes" role="group" aria-label="Density">
            {(['touch', 'pc'] as Density[]).map((d) => (
              <button key={d} className={d === density ? 'is-active' : ''} onClick={() => setDensity(d)}>
                {d === 'touch' ? 'Touch' : 'PC'}
              </button>
            ))}
          </div>
          <div className="ui-lab-sizes" role="group" aria-label="Notification dots">
            {NOTIF_TOGGLES.map((n) => (
              <button
                key={n.key}
                className={notifications[n.key] ? 'is-active' : ''}
                onClick={() => toggle(n.key)}
              >
                {n.label}
              </button>
            ))}
            <button className={skillLevelUpOn ? 'is-active' : ''} onClick={toggleSkillLevelUp}>
              Skill ↑
            </button>
          </div>
          <div className="ui-lab-sizes" role="group" aria-label="Profile">
            <button className={profileNew ? 'is-active' : ''} onClick={() => setProfileNew((v) => !v)}>
              New dot
            </button>
            <button
              className={profileRegion ? 'is-active' : ''}
              onClick={() => setProfileRegion((v) => !v)}
            >
              Region
            </button>
          </div>
        </div>
      </header>

      <div className="ui-lab-stage">
        <figure className="ui-lab-cell">
          <div className="ui-lab-profile-stage">
            <ProfileCard vm={profileVM} onOpen={() => {}} />
          </div>
          <figcaption>
            <strong>Profile identity block</strong>
            <span>frameless badges · hero avatar · Region + Level</span>
          </figcaption>
        </figure>
        <figure className="ui-lab-cell">
          <LabPanel skin={PIPELINE_SKIN} width={width} notifications={notifications} />
          <figcaption>
            <strong>Interactive previewer</strong>
            <span>detached wood bar · click tabs to switch sections</span>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
