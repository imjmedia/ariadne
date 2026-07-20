import { describe, it, expect } from 'vitest';
import { parseSource } from './parser';

describe('parseSource frontend domain models (interface/type)', () => {
  it('indexa export interface en src/Models como Model source=frontend con fields', () => {
    const src = `
export interface CampaniaModel {
  id: number;
  nombre: string;
  inicia?: string;
}
export interface CampaniaFormProps {
  onSave: () => void;
}
`;
    const r = parseSource('src/Models/CampaniaModel.tsx', src);
    expect(r?.models?.some((m) => m.name === 'CampaniaModel' && m.source === 'frontend')).toBe(
      true,
    );
    const campania = r?.models?.find((m) => m.name === 'CampaniaModel');
    expect(campania?.entityFields?.some((f) => f.startsWith('id:'))).toBe(true);
    expect(campania?.entityFields?.some((f) => f.startsWith('nombre:'))).toBe(true);
    expect(r?.models?.some((m) => m.name === 'CampaniaFormProps')).toBe(false);
  });

  it('indexa type object en src/modelsType y omite unions sin object body', () => {
    const src = `
export type DisponibilidadModel = {
  medioId: number;
  disponible: boolean;
};
export type TipoMedioType = 'sitios' | 'indoors' | 'urbanos';
`;
    const r = parseSource('src/modelsType/DisponibilidadModel.ts', src);
    expect(
      r?.models?.some(
        (m) =>
          m.name === 'DisponibilidadModel' &&
          m.source === 'frontend' &&
          (m.entityFields?.length ?? 0) > 0,
      ),
    ).toBe(true);
    expect(r?.models?.some((m) => m.name === 'TipoMedioType')).toBe(false);
  });

  it('rellena entityFields en class frontend bajo Models/', () => {
    const src = `
export class MaterialModel {
  id: number;
  nombre: string;
  costoxm2: number;
}
`;
    const r = parseSource('src/Models/MaterialModel.tsx', src);
    const m = r?.models?.find((x) => x.name === 'MaterialModel');
    expect(m?.source).toBe('frontend');
    expect(m?.entityFields).toEqual(expect.arrayContaining(['id', 'nombre', 'costoxm2']));
  });
});
