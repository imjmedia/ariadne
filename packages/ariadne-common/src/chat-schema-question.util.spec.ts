import { describe, expect, it } from 'vitest';
import {
  wantsArchitectureDomainQuestion,
  wantsReengineeringQuestion,
  wantsSchemaDatabaseQuestion,
} from './chat-schema-question.util.js';

describe('wantsArchitectureDomainQuestion', () => {
  it('detects coupling / new media architecture questions', () => {
    const msg =
      'tenemos sumamente acoplada la creación de medios, incluso a nivel de una entidad de bd por medio, necesitamos desacoplar y tener la flexibilidad de crear muy rápido nuevos medios';
    expect(wantsArchitectureDomainQuestion(msg)).toBe(true);
    expect(wantsReengineeringQuestion(msg)).toBe(true);
    expect(wantsSchemaDatabaseQuestion(msg)).toBe(false);
  });
});

describe('wantsSchemaDatabaseQuestion', () => {
  it('detects explicit schema / ERD requests', () => {
    expect(wantsSchemaDatabaseQuestion('puedes darme el diagrama de base de datos que debería quedar?')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('dame el esquema de la base de datos')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('content types de strapi')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('qué tablas y relaciones tiene la bd')).toBe(true);
  });

  it('does not fire on architecture domain questions', () => {
    expect(wantsSchemaDatabaseQuestion('esquema de colores del front')).toBe(false);
    expect(wantsSchemaDatabaseQuestion('cómo se conecta a la base de datos')).toBe(false);
    expect(wantsSchemaDatabaseQuestion('lista de componentes')).toBe(false);
  });

  it('requires explicit schema verbs for weak entidad+bd pairing', () => {
    expect(wantsSchemaDatabaseQuestion('entidades en prisma')).toBe(true);
    expect(wantsSchemaDatabaseQuestion('una entidad de bd por medio acoplado')).toBe(false);
  });
});
