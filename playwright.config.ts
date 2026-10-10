import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5173', locale: 'pt-BR' },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], locale: 'pt-BR' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], locale: 'pt-BR' } },
  ],
})
