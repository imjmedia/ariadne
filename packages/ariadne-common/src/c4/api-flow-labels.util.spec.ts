import { describe, expect, it } from 'vitest';
import {
  formatHttpCallLabel,
  inferMonorepoSegmentLabel,
  isArchifyWireProtocol,
} from './api-flow-labels.util.js';

describe('api-flow-labels.util', () => {
  it('formatHttpCallLabel evita duplicar GET', () => {
    expect(formatHttpCallLabel('GET', 'GET /api')).toBe('GET /api');
    expect(formatHttpCallLabel('GET', '/api/events')).toBe('GET /api/events');
  });

  it('isArchifyWireProtocol reconoce REST y rechaza inferencia', () => {
    expect(isArchifyWireProtocol('REST')).toBe(true);
    expect(isArchifyWireProtocol('Bus o cola detectada')).toBe(false);
  });

  it('inferMonorepoSegmentLabel humaniza apps y services', () => {
    expect(inferMonorepoSegmentLabel('apps/attendee-app/src/App.tsx', 'app')).toBe('Attendee App');
    expect(inferMonorepoSegmentLabel('services/ingest/src/main.ts', 'service')).toBe('Ingest');
  });
});
