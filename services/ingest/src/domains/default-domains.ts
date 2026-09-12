/**
 * Bounded contexts iniciales del tenant. Se insertan en `domains` si aún no existen (por nombre).
 */
export interface DefaultArchitectureDomain {
  name: string;
  description: string;
  color: string;
}

export const DEFAULT_ARCHITECTURE_DOMAINS: DefaultArchitectureDomain[] = [
  {
    name: 'Plataforma',
    description: 'Capacidades transversales, configuración y servicios compartidos del ecosistema.',
    color: '#6366f1',
  },
  {
    name: 'Identidad y acceso',
    description: 'Autenticación, autorización, usuarios, roles y permisos.',
    color: '#8b5cf6',
  },
  {
    name: 'Pagos',
    description: 'Cobros, reembolsos, conciliación y pasarelas de pago.',
    color: '#10b981',
  },
  {
    name: 'Catálogo',
    description: 'Productos, servicios, precios y disponibilidad.',
    color: '#f59e0b',
  },
  {
    name: 'Órdenes',
    description: 'Pedidos, flujos de compra y ciclo de vida de transacciones.',
    color: '#ef4444',
  },
  {
    name: 'CRM',
    description: 'Gestión de clientes, oportunidades, pipeline comercial y relaciones.',
    color: '#ec4899',
  },
  {
    name: 'Notificaciones',
    description: 'Email, SMS, push y mensajería transaccional.',
    color: '#06b6d4',
  },
  {
    name: 'Reporting y analítica',
    description: 'KPIs, dashboards, exportaciones y métricas de negocio.',
    color: '#64748b',
  },
  {
    name: 'Integraciones',
    description: 'APIs externas, ETL, buses de eventos y conectores.',
    color: '#a855f7',
  },
  {
    name: 'Infraestructura',
    description: 'Despliegue, observabilidad, CI/CD y plataforma técnica.',
    color: '#475569',
  },
];

export function normalizeDomainNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}
