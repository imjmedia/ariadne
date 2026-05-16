# ForgeOps — Plan de Producto

> **Propósito:** Plataforma SaaS para gestionar instancias dedicadas de TheForge + Ariadne en VPS Contabo. Producto independiente de ambos proyectos.

**Meta:** Que un cliente llegue a la landing, pague, y en <30 min tenga su propio VPS con TheForge + Ariadne funcionando, sin intervención manual.

**Stack propuesto:** Next.js + shadcn/ui + TailwindCSS + NestJS microservicios + PostgreSQL + Stripe + Contabo API

**Repositorio nuevo:** `forgeops` (separado de `theforge` y `ariadne`)

---

## Fase 1 — MVP (4-6 semanas)

### Módulo 1: Landing + Autenticación

**Objetivo:** Landing page pública + registro/login de clientes.

**Páginas:**
- `/` — Landing: hero, pricing tables (4 planes), features, FAQ, CTA
- `/auth/register` — Registro (email + password)
- `/auth/login` — Login
- `/auth/forgot-password` — Recuperación

**Stack:** Next.js App Router, shadcn/ui, TailwindCSS, NextAuth.js (credenciales), PostgreSQL (usuarios)

**Cada plan tiene:**
- Nombre (Starter/Pro/Studio/Agency)
- Precio mensual
- VPS asociado (S/M/L/XL)
- Tokens incluidos (500K/3M/10M/30M)
- Setup fee ($49/$49/$99/$149)
- Feature list

**Entidades:**
- `users` — id, email, password_hash, name, created_at
- `plans` — id, name, price_cents, setup_fee_cents, tokens_included, contabo_vps_tier, features_json

---

### Módulo 2: Dashboard de Cliente (protegido)

**Objetivo:** El cliente ve el estado de su VPS, tokens, proyectos.

**Páginas protegidas:**
- `/dashboard` — Resumen: VPS status (online/offline), tokens usados/restantes, proyectos creados, última actividad
- `/dashboard/billing` — Facturación: plan actual, historial de pagos, cambiar plan, cancelar
- `/dashboard/tokens` — Consumo de tokens: gráfica semanal/mensual, recarga manual
- `/dashboard/instance` — Detalle VPS: IP, CPU/RAM/disk usado, botón de reinicio, logs de provisioning

**Componentes clave:**
- `VpsStatusCard` — Indicador verde/rojo con uptime
- `TokenUsageGauge` — Barra de progreso (usado / total)
- `BillingTable` — Historial de pagos con fecha, monto, estado
- `SetupProgress` — Paso a paso del provisioning inicial

**Entidades nuevas:**
- `instances` — id, user_id, plan_id, contabo_instance_id, ip_address, status (provisioning/running/stopped/error), provisioned_at, last_seen_at
- `token_usage` — id, instance_id, tokens_used, period_start, period_end
- `payments` — id, user_id, amount_cents, stripe_payment_id, status, created_at

---

### Módulo 3: Provisioning Engine

**Objetivo:** Automatizar la creación de VPS en Contabo + instalación de TheForge + Ariadne.

**Flujo:**
1. Usuario paga → webhook de Stripe
2. Backend crea VPS vía API de Contabo (`POST /v1/compute/instances`)
3. Backend espera a que el VPS tenga IP y SSH disponible (~2-5 min)
4. Backend ejecuta script de provisioning vía SSH:
   - Instala Docker + Dokploy
   - Clona repos de TheForge + Ariadne
   - Configura env vars (MCP secrets, API keys, DB)
   - Ejecuta `docker compose up -d`
   - Configura dominio/subdominio (opcional)
5. Backend corre healthcheck: ¿responde el MCP? ¿La API?
6. Marca instancia como `running`, notifica al usuario

**Script de provisioning** (`scripts/provision.sh`):
```bash
#!/bin/bash
# Uso: curl -s https://forgeops.dev/provision | bash -s <api_key> <instance_id>
set -e

# 1. Docker + Dokploy
apt update && apt install -y docker.io docker-compose-plugin
curl -fsSL https://dokploy.com/install.sh | bash

# 2. Clone repos
git clone https://github.com/kreodevs/theforge /opt/theforge
git clone https://github.com/kreodevs/ariadne /opt/ariadne

# 3. Configure env vars (from API)
cat > /opt/theforge/.env <<EOF
MCP_M2M_SECRET=$1
DATABASE_URL=postgresql://...
EOF

# 4. Deploy
cd /opt/theforge && docker compose up -d
cd /opt/ariadne && docker compose up -d

# 5. Healthcheck
curl -f http://localhost:3000/api/health && echo "OK"
```

**Servicio backend (NestJS):**
- `ProvisioningService` — orquesta el flujo completo
- `ContaboApiService` — wrapper de la API de Contabo
- `SshService` — conexión SSH para ejecutar scripts
- `HealthCheckService` — verifica que los servicios respondan

**Entidades nuevas:**
- `provisioning_logs` — id, instance_id, step, status, message, created_at

---

### Módulo 4: Token Management

**Objetivo:** Controlar el consumo de tokens de AI por instancia y facturar.

**Flujo:**
1. Cada llamada a OpenAI/OpenRouter desde TheForge/Ariadne pasa por un proxy interno
2. El proxy registra tokens usados contra el `instance_id`
3. Al llegar al límite del plan, el proxy bloquea llamadas (o permite con advertencia)
4. El usuario puede comprar recargas de tokens desde el dashboard

**Proxy de tokens:**
- Servicio NestJS que envuelve el API de OpenRouter
- Autentica vía `instance_id` + `api_key` (secreta por instancia)
- Registra cada llamada en `token_usage`
- Rechaza si el límite se excedió

**Recarga de tokens:**
- Stripe: paquetes de 500K tokens por $5, 2M por $15, 10M por $50
- Se acreditan automáticamente al pagar

---

### Módulo 5: Admin Dashboard

**Objetivo:** Tú (admin) ves todas las instancias, facturación, logs.

**Páginas:**
- `/admin` — Resumen: clientes totales, ingresos MRR, instancias activas/en provisioning/en error
- `/admin/instances` — Lista de todas las instancias con estado, plan, cliente
- `/admin/instance/:id` — Detalle: logs de provisioning, consumo de tokens, acciones (reiniciar, detener, eliminar)
- `/admin/users` — Lista de clientes con plan, fecha de registro, última actividad
- `/admin/billing` — Ingresos totales, facturas impagas, churn rate
- `/admin/plans` — CRUD de planes de pricing

---

### Milestone de verificación entre módulos

| Módulo | Verificación |
|--------|-------------|
| M1 (Landing + Auth) | `npm run build` sin errores. Registro → login → sesión activa |
| M2 (Dashboard) | Dashboard funcional con datos mock. Navegación completa |
| M3 (Provisioning) | Provisionar VPS real en Contabo. TheForge + Ariadne responden |
| M4 (Token Mgmt) | Proxy registra tokens. Bloquea al límite. Recarga funciona |
| M5 (Admin) | CRUD de planes, visibilidad de todas las instancias |

---

## Fase 2 — Post-MVP (post-lanzamiento)

- **Subdominios automáticos** — `cliente.forgeops.dev` apunta a su instancia
- **Actualización remota** — Botón "Update" que hace git pull + redeploy
- **Backups automáticos** — Snapshot semanal del VPS
- **Notificaciones** — Email cuando los tokens estén al 80%, cuando el VPS esté listo
- **Gráficas avanzadas** — Costo por proyecto, eficiencia de tokens
- **White-label** — El cliente puede poner su propio dominio
- **API pública** — Para que clientes integren ForgeOps en su CI/CD

---

## Arquitectura de Microservicios

```
┌─────────────────────────────────────────────────────┐
│                  ForgeOps Web (Next.js)              │
│  Landing │ Dashboard │ Admin │ Billing Portal       │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              ForgeOps API Gateway (NestJS)           │
│  Auth │ Plans │ Instances │ Tokens │ Admin           │
└──┬───────────┬──────────┬───────────┬───────────────┘
   │           │          │           │
   ▼           ▼          ▼           ▼
┌──────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐
│Users │ │Contabo  │ │Stripe   │ │OpenRouter│
│ DB   │ │API      │ │Webhook  │ │Proxy     │
└──────┘ └─────────┘ └─────────┘ └──────────┘
              │
              ▼
       ┌──────────────┐
       │ VPS Cliente   │
       │ TheForge +    │
       │ Ariadne       │
       └──────────────┘
```

---

## Estructura de Archivos (ForgeOps)

```
forgeops/
├── apps/
│   └── web/                    # Next.js App Router
│       ├── app/
│       │   ├── page.tsx        # Landing
│       │   ├── auth/
│       │   ├── dashboard/
│       │   ├── admin/
│       │   └── api/            # API routes (auth, webhooks)
│       └── components/
│           ├── ui/             # shadcn/ui
│           └── features/       # VpsStatusCard, TokenGauge, etc.
├── services/
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── plans/
│       │   │   ├── instances/
│       │   │   ├── provisioning/
│       │   │   ├── tokens/
│       │   │   ├── billing/
│       │   │   └── admin/
│       │   └── common/
│       └── test/
├── scripts/
│   └── provision.sh            # Bash script que corre en el VPS
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## Pricing (confirmado con Contabo)

| Plan | VPS Contabo | Costo VPS | Tokens | Precio venta | Margen |
|------|-------------|-----------|--------|-------------|--------|
| Starter ($29/mes) | VPS S (€6.99) | $7.70 | 500K | $29 | 66% |
| Pro ($69/mes) | VPS M (€11.99) | $13.20 | 3M | $69 | 72% |
| Studio ($149/mes) | VPS L (€19.99) | $22.00 | 10M | $149 | 74% |
| Agency ($299/mes) | VPS XL (€35.99) | $39.50 | 30M | $299 | 77% |

Setup fee único: $49-$149 (según plan)

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Contabo API cambia/falla | Baja | Alto | Tener Hetzner como fallback |
| Cliente abusa de tokens | Media | Medio | Rate limiting + límites duros |
| Provisioning falla a medio camino | Media | Alto | Logging detallado + estado "error" + reintento manual |
| Un cliente DDoS su propio VPS | Baja | Bajo | Aislamiento total por VPS (no afecta a otros) |
| Churn por VPS lento | Baja | Medio | Upgrade paths claros en el dashboard |

---

## Próximos Pasos Inmediatos (si te late)

1. **Crear proyecto TheForge** para ForgeOps (documentación MDD + cascada)
2. **Setup del repo** `forgeops` con el stack base (Next.js + NestJS + shadcn/ui)
3. **Módulo 1** — Landing + Auth
4. **Módulo 2** — Dashboard de cliente
5. **Módulo 3** — Script de provisioning + Contabo API
6. **Módulo 4** — Token proxy + Stripe billing
7. **Módulo 5** — Admin dashboard
8. **Lanzamiento** — Product Hunt + Show HN
