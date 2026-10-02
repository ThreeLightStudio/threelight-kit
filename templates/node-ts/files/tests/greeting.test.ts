import { describe, expect, it } from 'vitest';
import { projectGreeting } from '../src/greeting.js';

describe('the project greeting', () => {
  it('identifies the supplied project and gives a useful next step', () => {
    const greeting = projectGreeting('  demo-service  ');

    expect(greeting).toContain('demo-service');
    expect(greeting).toContain('src/index.ts');
    expect(greeting).not.toContain('  demo-service  ');
  });

  it('rejects a missing project identity', () => {
    expect(() => projectGreeting('   ')).toThrow('Project name is required');
  });
});
