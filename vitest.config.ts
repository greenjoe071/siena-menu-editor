import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['handoff/snapshot-test.spec.js', 'handoff-monday/snapshot-test.spec.js', 'handoff-weekend/snapshot-test.spec.js', 'handoff-tueswed/snapshot-test.spec.js', 'handoff-happyhour/snapshot-test.spec.js', 'handoff-drinksdessert/snapshot-test.spec.js', 'handoff-privatedining/snapshot-test.spec.js'],
  },
});
