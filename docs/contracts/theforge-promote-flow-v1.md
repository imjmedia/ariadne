# The Forge promotion flow — Ariadne → Forge (v1)

## Secuencia

```text
1. Usuario: botón "Enviar a The Forge" (solo si integración activa en Ajustes)
2. Ariadne: ChangePromotionPackService.build(conversationId, …)
3. Ariadne → Forge: POST /theforge/resolve-forge-project-for-ariadne
4. Si ambiguo → UI selector (candidates 409)
5. Ariadne → Forge: POST /theforge/create-stage-from-ariadne-change-pack
6. Ariadne: persist forge_stage_id en chat_conversations
7. UI: link a etapa + optional recommendedNextTools (legacy en Forge)
```

## Endpoints Ariadne (ingest, proxy `/api`)

| Method | Path | Descripción |
|--------|------|-------------|
| GET | `/conversations/:id/forge-promotion` | Estado promoción |
| POST | `/conversations/:id/preview-theforge-pack` | Preview UI (sin Forge) |
| POST | `/conversations/:id/promote-to-theforge` | Resolve + create (si enabled) |

## Feature flags (ingest)

| Env / Ajustes | Efecto |
|-----|--------|
| **Ajustes → The Forge habilitado** + URL API | Promoción chat activa |
| `THEFORGE_PROMOTE_MOCK=true` | Cliente mock (dev/tests) |
| (default) | Sin botón en UI; endpoints promote → `503 FORGE_NOT_CONFIGURED` |

## Pendiente en The Forge

Nada bloqueante en Ariadne: el cliente HTTP ya llama los endpoints anteriores cuando la integración está activa en Ajustes.
