import { normalizeDomainNameKey } from './default-domains';

export interface CatalogDomainRef {
  id: string;
  name: string;
}

export interface DomainDependencyInferenceInput {
  projectDomainId: string | null;
  catalog: CatalogDomainRef[];
  existingDependsOnDomainIds: string[];
  packageDependencyNames: string[];
  workspaceEngineNames: string[];
  composeServiceNames: string[];
}

export interface InferredDomainDependency {
  dependsOnDomainId: string;
  dependsOnDomainName: string;
  connectionType: string;
  description: string;
}

const GENERIC_ENGINE_NAMES = new Set(
  [
    'api',
    'web',
    'frontend',
    'backend',
    'app',
    'shared',
    'common',
    'ui',
    'main',
    'core',
    'platform',
    'plataforma',
    'gateway',
    'bff',
    'worker',
    'workers',
  ].map((n) => normalizeDomainNameKey(n)),
);

const PACKAGE_RULES: Array<{
  domainName: string;
  connectionType: string;
  patterns: RegExp[];
  description: string;
}> = [
  {
    domainName: 'Pagos',
    connectionType: 'REST',
    patterns: [/stripe/i, /paypal/i, /mercadopago/i, /paddle/i, /braintree/i],
    description: 'Dependencia de cobros detectada en package.json',
  },
  {
    domainName: 'Notificaciones',
    connectionType: 'eventos',
    patterns: [/nodemailer/i, /twilio/i, /sendgrid/i, /resend/i, /@sendgrid/i],
    description: 'Cliente de mensajería detectado en package.json',
  },
  {
    domainName: 'Integraciones',
    connectionType: 'eventos',
    patterns: [/kafkajs/i, /amqplib/i, /@nestjs\/microservices/i, /nats/i, /bullmq/i, /bull\b/i],
    description: 'Bus o cola detectada en package.json',
  },
  {
    domainName: 'Infraestructura',
    connectionType: 'REST',
    patterns: [
      /@aws-sdk\//i,
      /\baws-sdk\b/i,
      /\bioredis\b/i,
      /\bredis\b/i,
      /\bminio\b/i,
      /@google-cloud\//i,
      /\bsharp\b/i,
      /\bffprobe/i,
      /\bfluent-ffmpeg\b/i,
    ],
    description: 'SDK de infraestructura o media detectado en package.json',
  },
  {
    domainName: 'Identidad y acceso',
    connectionType: 'REST',
    patterns: [/passport/i, /keycloak/i, /@clerk\//i, /amazon-cognito/i, /jsonwebtoken/i],
    description: 'Librería de autenticación detectada en package.json',
  },
  {
    domainName: 'CRM',
    connectionType: 'REST',
    patterns: [/hubspot/i, /salesforce/i, /pipedrive/i],
    description: 'Integración CRM detectada en package.json',
  },
];

const ENGINE_HINT_RULES: Array<{
  presetDomainName?: string;
  catalogKeywords: string[];
  namePatterns: RegExp[];
  connectionType: string;
  description: (hint: string) => string;
}> = [
  {
    presetDomainName: 'Catálogo',
    catalogKeywords: ['catalogo', 'precio', 'pricing', 'lista'],
    namePatterns: [/cost/i, /precio/i, /pricing/i, /tarifa/i, /catalog/i],
    connectionType: 'REST',
    description: (hint) => `Motor o paquete «${hint}» sugiere catálogo / precios`,
  },
  {
    presetDomainName: 'Notificaciones',
    catalogKeywords: ['notificacion', 'notification', 'mail', 'sms'],
    namePatterns: [/notif/i, /mail/i, /sms/i, /whatsapp/i],
    connectionType: 'eventos',
    description: (hint) => `Motor «${hint}» sugiere mensajería`,
  },
  {
    presetDomainName: 'Integraciones',
    catalogKeywords: ['integracion', 'integration', 'etl', 'sync'],
    namePatterns: [/integrat/i, /sync/i, /etl/i, /connector/i],
    connectionType: 'eventos',
    description: (hint) => `Motor «${hint}» sugiere integraciones`,
  },
  {
    catalogKeywords: ['media', 'video', 'render', 'ffmpeg', 'foto', 'memoria', 'gallery', 'asset'],
    namePatterns: [/media/i, /video/i, /render/i, /ffmpeg/i, /transcod/i, /gallery/i, /photo/i, /memoria/i],
    connectionType: 'eventos',
    description: (hint) => `Motor «${hint}» en el monorepo (media / video)`,
  },
];

function catalogByName(catalog: CatalogDomainRef[]): Map<string, CatalogDomainRef> {
  const map = new Map<string, CatalogDomainRef>();
  for (const d of catalog) {
    map.set(normalizeDomainNameKey(d.name), d);
  }
  return map;
}

function findCatalogDomain(
  catalog: CatalogDomainRef[],
  opts: { exactName?: string; keywords?: string[]; hint?: string },
): CatalogDomainRef | null {
  const byName = catalogByName(catalog);
  if (opts.exactName) {
    return byName.get(normalizeDomainNameKey(opts.exactName)) ?? null;
  }
  const hint = normalizeDomainNameKey(opts.hint ?? '');
  const keywords = (opts.keywords ?? []).map((k) => normalizeDomainNameKey(k));
  for (const domain of catalog) {
    const name = normalizeDomainNameKey(domain.name);
    if (keywords.some((k) => name.includes(k) || k.includes(name))) return domain;
    if (hint) {
      const hintTokens = hint.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
      if (hintTokens.some((t) => name.includes(t))) return domain;
      const nameTokens = name.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
      if (nameTokens.some((t) => hint.includes(t))) return domain;
    }
  }
  return null;
}

function isGenericEngineName(name: string): boolean {
  const key = normalizeDomainNameKey(name);
  if (GENERIC_ENGINE_NAMES.has(key)) return true;
  return key.length < 3;
}

function pushInference(
  out: Map<string, InferredDomainDependency>,
  domain: CatalogDomainRef,
  connectionType: string,
  description: string,
): void {
  if (out.has(domain.id)) return;
  out.set(domain.id, {
    dependsOnDomainId: domain.id,
    dependsOnDomainName: domain.name,
    connectionType,
    description,
  });
}

/**
 * Infiere whitelist proyecto→dominio desde manifiestos y nombres de motores del monorepo.
 * Solo devuelve dominios que ya existen en el catálogo.
 */
export function inferProjectDomainDependencies(
  input: DomainDependencyInferenceInput,
): InferredDomainDependency[] {
  const excluded = new Set(input.existingDependsOnDomainIds);
  if (input.projectDomainId) excluded.add(input.projectDomainId);

  const out = new Map<string, InferredDomainDependency>();
  const catalog = input.catalog;

  for (const depName of input.packageDependencyNames) {
    for (const rule of PACKAGE_RULES) {
      if (!rule.patterns.some((p) => p.test(depName))) continue;
      const domain = findCatalogDomain(catalog, { exactName: rule.domainName });
      if (!domain || excluded.has(domain.id)) continue;
      pushInference(out, domain, rule.connectionType, `${rule.description} (${depName})`);
    }
  }

  for (const serviceName of input.composeServiceNames) {
    if (/postgres|mysql|mongo|redis|mariadb|elasticsearch|rabbit/i.test(serviceName)) {
      const domain = findCatalogDomain(catalog, { exactName: 'Infraestructura' });
      if (domain && !excluded.has(domain.id)) {
        pushInference(
          out,
          domain,
          'REST',
          `Servicio de datos «${serviceName}» en docker-compose`,
        );
      }
    }
  }

  for (const rawName of input.workspaceEngineNames) {
    const name = rawName.trim();
    if (!name || isGenericEngineName(name)) continue;

    let matched = false;
    for (const rule of ENGINE_HINT_RULES) {
      if (!rule.namePatterns.some((p) => p.test(name))) continue;
      const domain =
        (rule.presetDomainName
          ? findCatalogDomain(catalog, { exactName: rule.presetDomainName })
          : null) ??
        findCatalogDomain(catalog, { keywords: rule.catalogKeywords, hint: name });
      if (!domain || excluded.has(domain.id)) continue;
      pushInference(out, domain, rule.connectionType, rule.description(name));
      matched = true;
      break;
    }
    if (!matched) {
      const fuzzy = findCatalogDomain(catalog, { hint: name });
      if (fuzzy && !excluded.has(fuzzy.id)) {
        pushInference(
          out,
          fuzzy,
          /event|queue|kafka|bull/i.test(name) ? 'eventos' : 'REST',
          `Paquete o servicio «${name}» del monorepo`,
        );
      }
    }
  }

  return [...out.values()];
}
