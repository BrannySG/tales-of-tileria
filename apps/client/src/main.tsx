import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

// Note: intentionally not using StrictMode — its double-invoke of effects in
// dev conflicts with the async Pixi Application lifecycle (create/destroy/create).
createRoot(container).render(<App />);
