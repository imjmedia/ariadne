import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import { describe, expect, it } from 'vitest';
import {
  buildTypeOrmFieldSummary,
  extractTypeOrmEntityIndexes,
  extractTypeOrmEntityTableName,
  extractTypeOrmFields,
  extractTypeOrmRelations,
  hasTypeOrmEmbeddableDecorator,
} from './typeorm-entity-metadata';

const LANG_TS = TypeScript.typescript;

function parseClass(source: string): Parser.SyntaxNode {
  const parser = new Parser();
  parser.setLanguage(LANG_TS as Parameters<Parser['setLanguage']>[0]);
  const tree = parser.parse(source);
  const cls =
    tree.rootNode.descendantsOfType('class_declaration')[0] ??
    tree.rootNode.descendantsOfType('abstract_class_declaration')[0];
  if (!cls) throw new Error('no class in fixture');
  return cls;
}

describe('typeorm-entity-metadata', () => {
  it('extrae tabla, índices, embedded y columnas extendidas', () => {
    const src = `@Entity('users')
@Index(['email'])
@Unique(['tenantId', 'email'])
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @CreateDateColumn() createdAt!: Date;
  @Embedded(() => Address) address!: Address;
}
`;
    const node = parseClass(src);
    expect(extractTypeOrmEntityTableName(node, src)).toBe('users');
    expect(extractTypeOrmEntityIndexes(node, src).some((i) => i.startsWith('Index('))).toBe(true);
    expect(extractTypeOrmEntityIndexes(node, src).some((i) => i.startsWith('Unique('))).toBe(true);
    const fields = extractTypeOrmFields(node, src);
    expect(buildTypeOrmFieldSummary(fields)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^id:PrimaryGeneratedColumn/),
        expect.stringMatching(/^createdAt:CreateDateColumn/),
        expect.stringMatching(/^address:Embedded\(Address\)/),
      ]),
    );
  });

  it('extrae ManyToMany con JoinTable e inferencia eventId + event', () => {
    const src = `@Entity()
export class Attendee {
  @Column() eventId!: string;
  event!: EventEntity;

  @ManyToMany(() => TagEntity)
  @JoinTable({ name: 'attendee_tags' })
  tags!: TagEntity[];
}
`;
    const node = parseClass(src);
    const rels = extractTypeOrmRelations(node, src);
    expect(rels).toEqual(
      expect.arrayContaining([
        {
          field: 'tags',
          targetType: 'TagEntity',
          relationKind: 'ManyToMany',
          joinColumn: undefined,
          joinTable: 'attendee_tags',
        },
        {
          field: 'event',
          targetType: 'EventEntity',
          relationKind: 'ManyToOne',
          joinColumn: 'eventId',
        },
      ]),
    );
  });

  it('detecta @Embeddable', () => {
    const src = `@Embeddable()
export class Address {
  @Column() street!: string;
}
`;
    const node = parseClass(src);
    expect(hasTypeOrmEmbeddableDecorator(node, src)).toBe(true);
  });
});
