import { describe, expect, it } from 'vitest';
import { parseStrapiGraphqlSchema } from './strapi-graphql-extract';

describe('strapi-graphql-extract', () => {
  it('extrae queries y mutations de schema.graphql Strapi', () => {
    const source = `module.exports = {
  query: \`
    mediosCercanos(distancia:Float,latitud: Float):[Medios],
    rutasEnArea(distancia:Float):[Rutas]
  \`,
  mutation: \`
    crearPuntos(input: createPuntoInputArray!): createPuntosPayload
  \`,
  resolver: {
    Query: {
      mediosCercanos: {
        description: 'Return the business nearby',
        resolverOf: 'Medios.cercanos',
      },
    },
    Mutation: {
      crearPuntos: {
        description: 'Agrega puntos',
        resolver: 'puntos.creaPuntos',
      },
    },
  },
};`;

    const ops = parseStrapiGraphqlSchema('src/api/medio/config/schema.graphql', source);
    const names = ops.map((o) => `${o.operationKind}:${o.name}`);
    expect(names).toContain('query:mediosCercanos');
    expect(names).toContain('query:rutasEnArea');
    expect(names).toContain('mutation:crearPuntos');
    const medios = ops.find((o) => o.name === 'mediosCercanos');
    expect(medios?.description).toContain('business nearby');
    expect(medios?.resolverOf).toBe('Medios.cercanos');
    expect(medios?.resolverAction).toBe('cercanos');
  });
});
