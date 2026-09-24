import { defineConfig, devices } from '@playwright/test';

// The e2e suite runs its own dev server on a dedicated port, never the one you keep open for
// manual testing, with the community API pointed at an unreachable address: .env.local targets the
// production Worker, and every test's fresh browser context would otherwise post visits (and any
// unmocked contribution) to production. Tests that need the API mock it with page.route().
const PORT = 5174;

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    env: { VITE_COMMUNITY_API_URL: 'http://127.0.0.1:9' },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // specs/011-search-onboarding: the Recherche page's guided tour opens on a first visit and, as a
    // modal, would block every other test's clicks. Marked as seen up front; a test about the tour
    // itself can clear it.
    // specs/003 (révision 2026-09-24): a new player now starts in Mode communautaire; these tests
    // were written from Mode personnel and switch to the community mode themselves when needed.
    storageState: {
      cookies: [],
      origins: [{
        origin: `http://127.0.0.1:${PORT}`,
        localStorage: [
          { name: 'craftcheck-search-tour-seen', value: '1' },
          { name: 'craftcheck-price-mode-choice', value: 'personal' },
        ],
      }],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
