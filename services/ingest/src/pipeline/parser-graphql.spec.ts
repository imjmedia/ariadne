import { describe, it, expect } from 'vitest';
import { parseSource, type ParsedFile } from './parser';

describe('parser - GraphQL (.graphql, .gql)', () => {
  it('parsea esquemas GraphQL y extrae tipos y operaciones a ParsedFile', () => {
    const schemaContent = `
      type Customer {
        id: ID!
        fullName: String!
        orders: [Order!]!
      }

      enum OrderStatus {
        PENDING
        COMPLETED
        CANCELLED
      }

      input FilterOrderInput {
        status: OrderStatus
        since: String
      }

      type Query {
        getCustomer(id: ID!): Customer
        searchOrders(filter: FilterOrderInput): [Order!]!
      }

      type Mutation {
        createOrder(customerId: ID!): Order!
      }
    `;

    const parsed = parseSource('src/schema/ecommerce.graphql', schemaContent) as ParsedFile;

    expect(parsed).toBeDefined();
    expect(parsed.path).toBe('src/schema/ecommerce.graphql');

    // Tipos de datos
    expect(parsed.graphQlTypes).toBeDefined();
    expect(parsed.graphQlTypes?.length).toBe(3); // Customer, OrderStatus, FilterOrderInput

    const customer = parsed.graphQlTypes?.find((t) => t.name === 'Customer');
    expect(customer?.kind).toBe('type');
    expect(customer?.fields).toEqual(['id', 'fullName', 'orders']);

    const status = parsed.graphQlTypes?.find((t) => t.name === 'OrderStatus');
    expect(status?.kind).toBe('enum');
    expect(status?.fields).toEqual(['PENDING', 'COMPLETED', 'CANCELLED']);

    // Operaciones (Queries / Mutations)
    expect(parsed.graphQlQueries).toBeDefined();
    expect(parsed.graphQlQueries.length).toBe(3); // getCustomer, searchOrders, createOrder

    const getCustomer = parsed.graphQlQueries.find((q) => q.name === 'getCustomer');
    expect(getCustomer?.operationKind).toBe('query');

    const createOrder = parsed.graphQlQueries.find((q) => q.name === 'createOrder');
    expect(createOrder?.operationKind).toBe('mutation');
  });

  it('parsea operaciones en archivos .gql de frontend', () => {
    const queryContent = `
      query GetCustomerProfile($id: ID!) {
        customer(id: $id) {
          id
          fullName
        }
      }
    `;

    const parsed = parseSource('src/graphql/getCustomer.gql', queryContent) as ParsedFile;

    expect(parsed).toBeDefined();
    expect(parsed.graphQlQueries).toHaveLength(1);
    expect(parsed.graphQlQueries[0]!.name).toBe('GetCustomerProfile');
    expect(parsed.graphQlQueries[0]!.operationKind).toBe('query');
  });
});
