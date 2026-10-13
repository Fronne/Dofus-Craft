import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles/global.css';
import '../src/styles/theme.css';
import './admin.css';
import { AdminPage } from './AdminPage';

// Same look as the site: the theme remembered on this device (localStorage is per origin, so the
// admin page keeps its own copy, defaulting like the site does).
function readTheme(): 'dark' | 'light' {
  try {
    return window.localStorage.getItem('craftcheck-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
document.documentElement.dataset.theme = readTheme();

createRoot(document.getElementById('root')!).render(<StrictMode><AdminPage /></StrictMode>);
