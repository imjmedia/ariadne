import { describe, expect, it } from 'vitest';
import { archifyCliOutput, isUnknownArchifyCommand } from './archify-cli.util';

describe('archify-cli.util', () => {
  it('detecta Unknown command deliver', () => {
    const result = {
      status: 1,
      stdout: '',
      stderr: 'Unknown command "deliver".\n\nUsage:\n  archify render ...',
    };
    expect(isUnknownArchifyCommand(result, 'deliver')).toBe(true);
  });

  it('no confunde fallo real de render con comando desconocido', () => {
    const result = {
      status: 1,
      stdout: '',
      stderr: 'Sequence layout validation failed',
    };
    expect(isUnknownArchifyCommand(result, 'deliver')).toBe(false);
    expect(archifyCliOutput(result)).toContain('layout validation');
  });
});
