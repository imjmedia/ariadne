import { describe, it, expect } from 'vitest';
import { parseSource } from './parser';

describe('parseSource TypeORM @Entity', () => {
  it('detecta @Entity encima de export class (decorador en export_statement)', () => {
    const src = `@Entity('paciente')
export class Paciente {
  @Column() id!: string;
}
`;
    const r = parseSource('src/m/p/entities/paciente.entity.ts', src);
    expect(r?.models?.some((m) => m.name === 'Paciente' && m.source === 'typeorm')).toBe(true);
  });

  it('detecta @Entity en abstract class (export) y marca typeorm', () => {
    const src = `@Entity()
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
}
`;
    const r = parseSource('src/m/p/entities/base.entity.ts', src);
    expect(r?.models?.some((m) => m.name === 'BaseEntity' && m.source === 'typeorm')).toBe(true);
  });

  it('sigue detectando export @Entity() class (decorador en la clase)', () => {
    const src = `export @Entity() class X {}
`;
    const r = parseSource('src/x.entity.ts', src);
    expect(r?.models?.some((m) => m.name === 'X' && m.source === 'typeorm')).toBe(true);
  });

  it('extrae @ManyToOne como entityRelations', () => {
    const src = `@Entity()
export class Attendee {
  @Column() eventId!: string;

  @ManyToOne(() => EventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: EventEntity;
}
`;
    const r = parseSource('src/entities/attendee.entity.ts', src);
    const model = r?.models?.find((m) => m.name === 'Attendee');
    expect(model?.entityRelations).toEqual([
      { field: 'event', targetType: 'EventEntity', relationKind: 'ManyToOne' },
    ]);
  });
});
