// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',   // we only test pure TS helpers right now
        reporters: 'default',
    },
    // Disable CSS/PostCSS loading during tests
    css: {
        postcss: {
            plugins: [],
        },
    },
});
