/**
 * Metadatos TypeORM extraídos del AST (complementa inferencia en chat).
 */
import type Parser from 'tree-sitter';

export interface TypeOrmRelationMeta {
  field: string;
  targetType: string;
  relationKind: 'ManyToOne' | 'OneToOne' | 'ManyToMany' | 'OneToMany';
  joinColumn?: string;
  joinTable?: string;
}

export interface TypeOrmFieldMeta {
  name: string;
  columnHint?: string;
  propertyType?: string;
  embedded?: string;
}

const RELATION_DECORATORS = new Set(['ManyToOne', 'OneToOne', 'ManyToMany', 'OneToMany']);
const COLUMN_DECORATORS = new Set([
  'Column',
  'PrimaryColumn',
  'PrimaryGeneratedColumn',
  'CreateDateColumn',
  'UpdateDateColumn',
  'DeleteDateColumn',
  'VersionColumn',
]);

function getNodeText(src: string, node: Parser.SyntaxNode): string {
  return src.slice(node.startIndex, node.endIndex);
}

function findNodesByType(root: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
  const out: Parser.SyntaxNode[] = [];
  const stack: Parser.SyntaxNode[] = [root];
  while (stack.length) {
    const n = stack.pop()!;
    if (types.includes(n.type)) out.push(n);
    for (let i = n.childCount - 1; i >= 0; i--) {
      const c = n.child(i);
      if (c) stack.push(c);
    }
  }
  return out;
}

function getDecoratorCallee(dec: Parser.SyntaxNode, source: string): string | null {
  const call = dec.childForFieldName('expression') ?? findNodesByType(dec, ['call_expression'])[0];
  if (!call || call.type !== 'call_expression') {
    const id = dec.childForFieldName('expression') ?? findNodesByType(dec, ['identifier'])[0];
    return id?.type === 'identifier' ? getNodeText(source, id) : null;
  }
  const callee = call.childForFieldName('function') ?? call.childForFieldName('callee');
  if (!callee) return null;
  if (callee.type === 'identifier') return getNodeText(source, callee);
  if (callee.type === 'member_expression') {
    const prop = callee.childForFieldName('property') ?? callee.lastNamedChild;
    return prop ? getNodeText(source, prop) : null;
  }
  return null;
}

function extractDecoratorStringArg(dec: Parser.SyntaxNode, source: string): string | null {
  const call = dec.childForFieldName('expression') ?? findNodesByType(dec, ['call_expression'])[0];
  if (!call || call.type !== 'call_expression') return null;
  const args = call.childForFieldName('arguments');
  if (!args) return null;
  for (let i = 0; i < args.childCount; i++) {
    const arg = args.child(i);
    if (!arg || arg.type === ',' || arg.type === '(' || arg.type === ')') continue;
    if (arg.type === 'string') return getNodeText(source, arg).replace(/^['"`]|['"`]$/g, '').trim();
    if (arg.type === 'arrow_function') {
      const bodyNode = arg.childForFieldName('body') ?? arg.lastNamedChild;
      if (!bodyNode) return null;
      if (bodyNode.type === 'identifier') return getNodeText(source, bodyNode);
      const id = findNodesByType(bodyNode, ['identifier'])[0];
      return id ? getNodeText(source, id) : null;
    }
    if (arg.type === 'identifier') return getNodeText(source, arg);
    break;
  }
  return null;
}

function extractJoinColumnName(fieldNode: Parser.SyntaxNode, source: string): string | null {
  for (const dec of findNodesByType(fieldNode, ['decorator'])) {
    if (getDecoratorCallee(dec, source) !== 'JoinColumn') continue;
    const call = dec.childForFieldName('expression') ?? findNodesByType(dec, ['call_expression'])[0];
    if (!call || call.type !== 'call_expression') continue;
    const args = call.childForFieldName('arguments');
    const text = args ? getNodeText(source, args) : '';
    const nameMatch = text.match(/name\s*:\s*['"]([^'"]+)['"]/);
    if (nameMatch?.[1]) return nameMatch[1];
    const strMatch = text.match(/['"]([^'"]+)['"]/);
    return strMatch?.[1] ?? null;
  }
  return null;
}

function extractJoinTableName(fieldNode: Parser.SyntaxNode, source: string): string | null {
  for (const dec of findNodesByType(fieldNode, ['decorator'])) {
    if (getDecoratorCallee(dec, source) !== 'JoinTable') continue;
    const call = dec.childForFieldName('expression') ?? findNodesByType(dec, ['call_expression'])[0];
    if (!call || call.type !== 'call_expression') continue;
    const args = call.childForFieldName('arguments');
    const text = args ? getNodeText(source, args) : '';
    const nameMatch = text.match(/name\s*:\s*['"]([^'"]+)['"]/);
    if (nameMatch?.[1]) return nameMatch[1];
    return null;
  }
  return null;
}

function extractPropertyType(fieldNode: Parser.SyntaxNode, source: string): string | null {
  const typeNode = fieldNode.childForFieldName('type');
  if (!typeNode) return null;
  const raw = getNodeText(source, typeNode).replace(/\s+/g, ' ').trim();
  const base = raw
    .replace(/\[.*\]/g, '')
    .replace(/\?/g, '')
    .replace(/^:\s*/, '')
    .replace(/!$/, '')
    .split(/[<,|&]/)[0]
    ?.trim();
  return base || null;
}

function extractColumnHint(fieldNode: Parser.SyntaxNode, source: string): string | null {
  for (const dec of findNodesByType(fieldNode, ['decorator'])) {
    const callee = getDecoratorCallee(dec, source);
    if (!callee || !COLUMN_DECORATORS.has(callee)) continue;
    const call = dec.childForFieldName('expression') ?? findNodesByType(dec, ['call_expression'])[0];
    if (!call || call.type !== 'call_expression') return callee;
    const args = call.childForFieldName('arguments');
    const argText = args ? getNodeText(source, args).replace(/\s+/g, ' ').trim().slice(0, 100) : '';
    return argText ? `${callee}(${argText})` : callee;
  }
  return null;
}

function extractEmbeddedTarget(fieldNode: Parser.SyntaxNode, source: string): string | null {
  for (const dec of findNodesByType(fieldNode, ['decorator'])) {
    if (getDecoratorCallee(dec, source) !== 'Embedded') continue;
    return extractDecoratorStringArg(dec, source);
  }
  return null;
}

export function extractTypeOrmEntityTableName(classNode: Parser.SyntaxNode, source: string): string | undefined {
  for (const dec of collectClassDecorators(classNode)) {
    if (getDecoratorCallee(dec, source) !== 'Entity') continue;
    const name = extractDecoratorStringArg(dec, source);
    if (name && !name.includes('(') && !name.includes('=>')) return name;
  }
  return undefined;
}

export function hasTypeOrmEmbeddableDecorator(classNode: Parser.SyntaxNode, source: string): boolean {
  for (const dec of collectClassDecorators(classNode)) {
    if (getDecoratorCallee(dec, source) === 'Embeddable') return true;
  }
  return false;
}

export function extractTypeOrmEntityIndexes(classNode: Parser.SyntaxNode, source: string): string[] {
  const indexes: string[] = [];
  for (const dec of collectClassDecorators(classNode)) {
    const callee = getDecoratorCallee(dec, source);
    if (callee !== 'Index' && callee !== 'Unique') continue;
    const call = dec.childForFieldName('expression') ?? findNodesByType(dec, ['call_expression'])[0];
    const args = call?.type === 'call_expression' ? call.childForFieldName('arguments') : null;
    const argText = args ? getNodeText(source, args).replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    indexes.push(argText ? `${callee}(${argText})` : callee!);
  }
  return indexes;
}

export function extractTypeOrmFields(classNode: Parser.SyntaxNode, source: string): TypeOrmFieldMeta[] {
  const body = classNode.childForFieldName('body');
  if (!body) return [];
  const fields: TypeOrmFieldMeta[] = [];
  for (let i = 0; i < body.childCount; i++) {
    const ch = body.child(i);
    if (!ch || ch.type !== 'public_field_definition') continue;
    const nameNode = ch.childForFieldName('name');
    if (!nameNode) continue;
    const name = getNodeText(source, nameNode);
    const embedded = extractEmbeddedTarget(ch, source);
    fields.push({
      name,
      columnHint: extractColumnHint(ch, source) ?? undefined,
      propertyType: extractPropertyType(ch, source) ?? undefined,
      embedded: embedded ?? undefined,
    });
  }
  return fields;
}

export function extractTypeOrmRelations(classNode: Parser.SyntaxNode, source: string): TypeOrmRelationMeta[] {
  const body = classNode.childForFieldName('body');
  if (!body) return [];
  const rels: TypeOrmRelationMeta[] = [];
  const fieldTypes = new Map<string, string>();

  for (let i = 0; i < body.childCount; i++) {
    const ch = body.child(i);
    if (!ch || ch.type !== 'public_field_definition') continue;
    const nameNode = ch.childForFieldName('name');
    if (!nameNode) continue;
    const field = getNodeText(source, nameNode);
    const propType = extractPropertyType(ch, source);
    if (propType) fieldTypes.set(field, propType);

    for (const dec of findNodesByType(ch, ['decorator'])) {
      const callee = getDecoratorCallee(dec, source);
      if (!callee || !RELATION_DECORATORS.has(callee)) continue;
      let targetType = extractDecoratorStringArg(dec, source);
      if (!targetType || targetType.includes('(')) targetType = propType ?? targetType;
      if (!targetType) continue;
      rels.push({
        field,
        targetType,
        relationKind: callee as TypeOrmRelationMeta['relationKind'],
        joinColumn: extractJoinColumnName(ch, source) ?? undefined,
        joinTable: extractJoinTableName(ch, source) ?? undefined,
      });
    }
  }

  const seen = new Set(rels.map((r) => `${r.field}|${r.targetType}`));
  const fieldsWithDecoratorRel = new Set(rels.map((r) => r.field));
  for (const [field] of fieldTypes) {
    if (field === 'id' || !field.endsWith('Id') || field.length <= 2) continue;
    const nav = field.slice(0, -2);
    if (!nav || fieldsWithDecoratorRel.has(nav)) continue;
    const navType = fieldTypes.get(nav);
    if (!navType) continue;
    const key = `${nav}|${navType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rels.push({
      field: nav,
      targetType: navType,
      relationKind: 'ManyToOne',
      joinColumn: field,
    });
  }

  return rels;
}

function collectClassDecorators(classNode: Parser.SyntaxNode): Parser.SyntaxNode[] {
  const out: Parser.SyntaxNode[] = [];
  for (let i = 0; i < classNode.childCount; i++) {
    const ch = classNode.child(i);
    if (ch?.type === 'decorator') out.push(ch);
  }
  const parent = classNode.parent;
  if (parent?.type === 'export_statement') {
    for (let i = 0; i < parent.childCount; i++) {
      const ch = parent.child(i);
      if (ch?.type === 'decorator') out.push(ch);
    }
  }
  return out;
}

export function buildTypeOrmFieldSummary(fields: TypeOrmFieldMeta[]): string[] {
  return fields.slice(0, 120).map((f) => {
    if (f.embedded) return `${f.name}:Embedded(${f.embedded})`;
    if (f.columnHint) return `${f.name}:${f.columnHint}`;
    if (f.propertyType) return `${f.name}:${f.propertyType}`;
    return f.name;
  });
}
