import { seedStore } from '../../src/domain/seed.js';

/** 5 Nov 2026, 10:00 IST. Fixed so date-based tests are deterministic. */
export const NOW = new Date('2026-11-05T10:00:00+05:30').getTime();
export const freshStore = () => seedStore(NOW);
