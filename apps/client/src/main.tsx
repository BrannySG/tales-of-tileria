import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadGameFonts } from './assets/fonts';
import { applyLiveResetEpoch } from './persistence/liveReset';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Apply one-shot global reset wipes when LIVE_RESET_EPOCH changes.
applyLiveResetEpoch();

// Kick off the web font load early so DOM UI swaps to DERRICK ASAP.
void loadGameFonts();

// Note: intentionally not using StrictMode — its double-invoke of effects in
// dev conflicts with the async Pixi Application lifecycle (create/destroy/create).
createRoot(container).render(<App />);
