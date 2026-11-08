import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://mock.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      ORGANIZER_PASSWORD_HASH: '$2b$10$BBCWYG6EK3lv6GMrRrJqBulbxLim3PNjln9FnCM0yJczzCOLni2re',
      ORGANIZER_CONTROL_HASH: '$2b$10$BBCWYG6EK3lv6GMrRrJqBulbxLim3PNjln9FnCM0yJczzCOLni2re',
      NEXTAUTH_SECRET: 'test-secret-salt-cryptx-2026-production-ready',
      SESSION_SECRET: 'test-secret-salt-cryptx-2026-production-ready',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'json', 'html'],
      clean: false,
      cleanOnRerun: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
