import { describe, expect, it } from 'vitest';
import {
  inferTypeOrmRelationsFromModels,
  resolveTypeOrmTargetName,
} from '../pipeline/typeorm-schema.util';

describe('inferTypeOrmRelationsFromModels', () => {
  it('infiere relaciones desde columnas *Id y propiedades de navegación', () => {
    const models = [
      {
        name: 'Attendee',
        fieldSummary: JSON.stringify(['id', 'eventId', 'event', 'name']),
      },
      {
        name: 'Event',
        fieldSummary: JSON.stringify(['id', 'plannerId', 'planner', 'orderId', 'order']),
      },
      { name: 'User', fieldSummary: JSON.stringify(['id', 'email']) },
      { name: 'Order', fieldSummary: JSON.stringify(['id', 'userId', 'user', 'packageId', 'package']) },
      { name: 'Package', fieldSummary: JSON.stringify(['id', 'name']) },
    ];

    const rels = inferTypeOrmRelationsFromModels(models);
    expect(rels.length).toBeGreaterThanOrEqual(6);
    expect(rels).toContainEqual({ fromEntity: 'Attendee', toEntity: 'Event', field: 'eventId' });
    expect(rels).toContainEqual({ fromEntity: 'Order', toEntity: 'User', field: 'userId' });
    expect(rels).toContainEqual({ fromEntity: 'Order', toEntity: 'Package', field: 'packageId' });
  });

  it('resuelve sufijo Entity en decoradores TypeORM', () => {
    const names = ['Event', 'Attendee'];
    expect(resolveTypeOrmTargetName('EventEntity', names)).toBe('Event');
    expect(resolveTypeOrmTargetName('AttendeeEntity', names)).toBe('Attendee');
  });
});
