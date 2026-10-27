import { describe, it, expect } from 'vitest';
import { parseGenericGraphQl } from './graphql-schema-extract';

describe('graphql-schema-extract', () => {
  it('extrae tipos, interfaces, inputs, enums y unions de schema SDL', () => {
    const sdl = `
      """Usuario del sistema"""
      type User implements Node {
        id: ID!
        username: String!
        email: String!
        role: Role!
      }

      interface Node {
        id: ID!
      }

      input CreateUserInput {
        username: String!
        email: String!
      }

      enum Role {
        ADMIN
        USER
        GUEST
      }

      union SearchResult = User | Comment
    `;

    const result = parseGenericGraphQl('src/schema.graphql', sdl);

    expect(result.types).toHaveLength(5);

    const userType = result.types.find((t) => t.name === 'User');
    expect(userType).toBeDefined();
    expect(userType?.kind).toBe('type');
    expect(userType?.fields).toContain('id');
    expect(userType?.fields).toContain('username');
    expect(userType?.fields).toContain('email');
    expect(userType?.fields).toContain('role');

    const nodeInterface = result.types.find((t) => t.name === 'Node');
    expect(nodeInterface?.kind).toBe('interface');
    expect(nodeInterface?.fields).toContain('id');

    const input = result.types.find((t) => t.name === 'CreateUserInput');
    expect(input?.kind).toBe('input');
    expect(input?.fields).toEqual(['username', 'email']);

    const roleEnum = result.types.find((t) => t.name === 'Role');
    expect(roleEnum?.kind).toBe('enum');
    expect(roleEnum?.fields).toEqual(['ADMIN', 'USER', 'GUEST']);

    const union = result.types.find((t) => t.name === 'SearchResult');
    expect(union?.kind).toBe('union');
    expect(union?.fields).toEqual(['User', 'Comment']);
  });

  it('extrae operaciones declaradas en type Query y type Mutation', () => {
    const sdl = `
      type Query {
        getUser(id: ID!): User
        listUsers: [User!]!
      }

      type Mutation {
        createUser(input: CreateUserInput!): User
        deleteUser(id: ID!): Boolean
      }

      type Subscription {
        userCreated: User
      }
    `;

    const result = parseGenericGraphQl('schema.gql', sdl);

    expect(result.types).toHaveLength(0); // Query, Mutation y Subscription se extraen como operations
    expect(result.operations).toHaveLength(5);

    const getUser = result.operations.find((o) => o.name === 'getUser');
    expect(getUser?.operationKind).toBe('query');

    const createUser = result.operations.find((o) => o.name === 'createUser');
    expect(createUser?.operationKind).toBe('mutation');

    const userCreated = result.operations.find((o) => o.name === 'userCreated');
    expect(userCreated?.operationKind).toBe('subscription');
  });

  it('extrae operaciones ejecutables nombradas en archivos de frontend/queries', () => {
    const doc = `
      query GetActiveUsers($limit: Int) {
        users(limit: $limit) {
          id
          name
        }
      }

      mutation RemoveAccount($id: ID!) {
        deleteUser(id: $id) {
          success
        }
      }
    `;

    const result = parseGenericGraphQl('src/queries/users.graphql', doc);

    expect(result.operations).toHaveLength(2);
    expect(result.operations[0]).toEqual({ name: 'GetActiveUsers', operationKind: 'query' });
    expect(result.operations[1]).toEqual({ name: 'RemoveAccount', operationKind: 'mutation' });
  });
});
