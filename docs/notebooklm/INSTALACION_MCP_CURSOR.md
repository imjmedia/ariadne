# Instalación del MCP AriadneSpecs para Cursor — Mantenimiento de Ariadne

Documento de instalación y configuración del servidor MCP AriadneSpecs Oracle para dar mantenimiento al proyecto **Ariadne** con **Cursor** u otros IDEs compatibles con MCP.

**Deployment:** Frontend [ariadne.kreoint.mx](https://ariadne.kreoint.mx) | Backend [apiariadne.kreoint.mx](https://apiariadne.kreoint.mx)

---

## 1. Resumen

El MCP AriadneSpecs expone herramientas que permiten a la IA (Cursor, Antigravity, etc.) consultar el grafo de FalkorDB **antes** de modificar código, reduciendo alucinaciones y rupturas:

- **Configuración Zero-Config de 1 Paso:** `npx ariadne link` conecta cualquier proyecto automáticamente con Cursor.
- **Sincronización Local Live (Live Daemon + WAL Offline):** Sincroniza deltas locales al grafo en tiempo real (<50ms) sin necesidad de commit/push a Bitbucket, con tolerancia a caídas mediante Write-Ahead Log en disco.
- **Graph RAG con Ego-Graphs:** Recupera contratos TypeScript exactos y relaciones a 1 salto para eliminar alucinaciones de props.
- **Soporte Políglota y Bilingüe:** Análisis de TypeScript, JavaScript, Prisma, Strapi, Python (FastAPI/Django), Go (Gin) y Rust (Actix), con expansión léxica automática español ↔ inglés.
- **validate_before_edit** — Obligatorio antes de editar: impacto + contrato + endpoints de funciones.
- **detect_changes** — Análisis de radio de impacto pre-commit.
- **get_modification_plan** — Plan quirúrgico (`filesToModify` + `questionsToRefine`).

---

## 2. Requisitos

- **Node.js** >= 20
- **Cursor** (o IDE compatible con MCP)
- **Conexión** a FalkorDB y al servicio Ingest

---

## 3. Instalación Rápida (Recomendada: Zero-Config)

En la raíz del proyecto que vas a programar en Cursor, ejecuta un único comando:

```bash
# Caso 1: Desarrollo local en tu máquina (asume http://localhost:3002 por defecto):
ariadne link

# Caso 2: Conectar a servidor en producción (Dokploy) con tu Secret MCP:
ariadne link --server https://ariadne.kreoint.mx --token ari_...

# Caso 3: Para desarrolladores sin Ariadne clonado (descarga directa desde GitHub):
npx -y github:kreodevs/ariadne link --server https://ariadne.kreoint.mx --token ari_...
```

### Parámetros de conexión y URLs según el entorno

| Entorno | URL del Servidor (`--server`) | Token (`--token`) | ¿Cuándo usarlo? |
|---|---|---|---|
| **Local (Docker / Dev)** | `http://localhost:3002` *(Default)* | Opcional (si local no tiene auth) | Cuando tienes Ariadne corriendo en tu propia computadora (`pnpm run dev:infra`, `pnpm run dev:ingest`). |
| **Dokploy / Producción** | `https://ariadne.kreoint.mx` | **Obligatorio:** Secret MCP (`ari_...`) | Cuando Ariadne está desplegado en un VPS o servidor con Dokploy. |

> 🔑 **¿Dónde obtengo mi token `ari_...`?**
> 1. Entra a tu panel web de Ariadne: `https://ariadne.kreoint.mx`
> 2. Haz clic en tu avatar o menú de **Perfil** (arriba a la derecha).
> 3. En la sección **Secret MCP**, copia tu clave secreta personal (comienza con `ari_...`).

> 💡 **Nota sobre la ruta `/mcp`:**
> - `https://ariadne.kreoint.mx` (sin `/mcp`) es la URL base que se pasa al flag `--server` para que el watcher y el CLI se comuniquen con la API/Ingest.
> - `https://ariadne.kreoint.mx/mcp` (con `/mcp`) es únicamente el endpoint HTTP si decides conectar Cursor directamente por URL en modo remoto sin usar el comando local.

**¿Qué hace automáticamente el comando `link`?**
1. Auto-detecta el repositorio Git actual y genera `.cursor/mcp.json` configurado en transporte nativo **STDIO**.
2. Crea el archivo de reglas [AGENTS.md](../AGENTS.md) canónico para que Cursor consulte el grafo antes de editar.
3. Registra `.ariadne/config.json` con los metadatos de sincronización.
4. Activa el **Live Watcher en segundo plano**: Cursor inicia la observación de archivos locales automáticamente sin que tengas que abrir terminales secundarias, con Write-Ahead Log (WAL) para trabajar sin conexión en modo avión o tolerar reinicios del servidor.

---

## 4. Escenarios de conexión manual

### Escenario A: Desarrollo local (recomendado para mantenimiento del propio Ariadne)

Infraestructura y servicios corriendo en tu máquina. El MCP soporta transporte dual **STDIO** y **Streamable HTTP** (puerto 8080).

| Variable | Valor |
|----------------|----------------------|
| FALKORDB_HOST | `localhost` |
| FALKORDB_PORT | `6379` |
| INGEST_URL | `http://localhost:3002` |
| PORT | `8080` (en modo HTTP) |

**Previo:**
```bash
pnpm run dev:infra # FalkorDB, Postgres, Redis
pnpm run dev:ingest # Ingest (puerto 3002)
pnpm -C services/mcp-ariadne build
# Opcional en modo HTTP: PORT=8080 node services/mcp-ariadne/dist/index.js
```

---

### Escenario B: Producción por URL (sin túnel)

Si Ariadne está en Dokploy con MCP en Streamable HTTP (puerto 8080):

| Variable | Valor |
|----------------|------------------------------------|
| URL | `https://ariadne.kreoint.mx/mcp` |

Cursor se conecta directamente por URL. En producción añade **`headers.Authorization: Bearer`** con tu **Secret MCP** (`ari_…` desde Perfil) o un **JWT de sesión** válido (ver Paso 4). Solo en desarrollo con `MCP_HTTP_ALLOW_UNAUTHENTICATED=1` puedes omitir el Bearer sobre `/mcp`.

### Escenario C: Producción con MCP local + túnel SSH

Conectarse al backend con MCP corriendo localmente (HTTP en 8080) y túnel:

| Variable | Valor |
|----------------|------------------------------------|
| FALKORDB_HOST | `localhost` (vía túnel) |
| FALKORDB_PORT | `6379` |
| INGEST_URL | `https://apiariadne.kreoint.mx` |

**Previo:** `ssh -L 6379:127.0.0.1:6379 usuario@apiariadne.kreoint.mx` (y exponer FalkorDB en el host).

### Escenario D: Dokploy + túnel SSH (alternativa a B)

Cuando Ariadne está en Docker bajo **Dokploy** y usas MCP local (no la URL), FalkorDB vive dentro de un contenedor. Para que el túnel SSH funcione:

#### 1. Exponer FalkorDB en el host (obligatorio)

En Dokploy, edita la aplicación Ariadne → servicio **falkordb** → añade *Port publishing*:

- **Host port:** 6379
- **Container port:** 6379

O en el compose de Dokploy:

```yaml
falkordb:
 # ...
 ports:
 - "127.0.0.1:6379:6379"
```

`127.0.0.1` limita el puerto al host; solo accesible vía túnel SSH.

#### 2. Crear túnel SSH

```bash
ssh -L 6379:127.0.0.1:6379 usuario@HOST_RELIC
```

- Reemplaza `HOST_RELIC` por la IP o dominio del servidor (ej. `apiariadne.kreoint.mx`).
- Mantén la sesión abierta mientras uses el MCP.
- Opcional: `-f -N` para dejarlo en segundo plano.

#### 3. Dar de alta usuarios para el túnel

Cada usuario debe poder hacer SSH al servidor. En el host (acceso root/admin):

```bash
# Crear usuario
sudo adduser dev-mcp
# O sin shell interactivo: sudo useradd -m -s /usr/bin/bash dev-mcp

# Configurar autenticación por clave (recomendado)
su - dev-mcp
mkdir -p ~/.ssh
chmod 700 ~/.ssh
```

El usuario genera su clave local:

```bash
ssh-keygen -t ed25519 -C "dev-mcp@ariadne"
```

Envía la clave pública. En el servidor:

```bash
# Como dev-mcp o root
echo "ssh-ed25519 AAAAC3... dev-mcp@ariadne" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

O desde el admin:

```bash
sudo -u dev-mcp bash -c 'echo "ssh-ed25519 AAAAC3... tu-clave" >> /home/dev-mcp/.ssh/authorized_keys'
```

**Probar conexión:**

```bash
ssh dev-mcp@HOST_RELIC
# Si entra, el túnel funcionará:
ssh -L 6379:127.0.0.1:6379 dev-mcp@HOST_RELIC
```

#### 4. Configuración MCP con túnel

Con el túnel activo, inicia el MCP localmente (en otra terminal):

```bash
cd ariadne
FALKORDB_HOST=localhost FALKORDB_PORT=6379 INGEST_URL=https://apiariadne.kreoint.mx PORT=8080 node services/mcp-ariadne/dist/index.js
```

Luego en Cursor usa la URL local:

```json
{
 "mcpServers": {
 "ariadnespecs": {
 "url": "http://localhost:8080/mcp"
 }
 }
}
```

---

## 4. Instalación en Cursor

### Paso 1: Clonar el repositorio

```bash
git clone <url-del-repo-ariadne> ariadne
cd ariadne
```

### Paso 2: Instalar dependencias y compilar el MCP

```bash
pnpm install
pnpm -C services/mcp-ariadne install
pnpm -C services/mcp-ariadne build
```

### Paso 3: Configurar el MCP en Cursor

1. Abrir **Cursor** y abrir la carpeta `ariadne` como workspace.
2. Ir a **Settings** (Cmd/Ctrl +) → **Cursor Settings** → **MCP**.
3. Editar el archivo de configuración MCP (o crearlo si no existe).

En macOS/Linux suele estar en:
```
~/.cursor/mcp.json
```

En Windows:
```
%APPDATA%\Cursor\mcp.json
```

### Paso 4: Añadir el servidor AriadneSpecs

Añadir esta entrada al JSON de MCP:

**Desarrollo local (Escenario A):**

Previo: arrancar el MCP en tu máquina (`PORT=8080 node dist/index.js` con FALKORDB_HOST, INGEST_URL). Luego:

```json
{
 "mcpServers": {
 "ariadnespecs": {
 "url": "http://localhost:8080/mcp"
 }
 }
}
```

**Producción por URL (Escenario B, sin túnel):**
```json
{
 "mcpServers": {
 "ariadnespecs": {
 "url": "https://ariadne.kreoint.mx/mcp"
 }
 }
}
```

**Producción con Bearer (recomendado):** mismo token que usarías tras login web o el **Secret MCP** de Perfil (no hay `ARIADNE_API_*` en `.env` para esto):
```json
{
 "mcpServers": {
 "ariadnespecs": {
 "url": "https://ariadne.kreoint.mx/mcp",
 "headers": {
 "Authorization": "Bearer <ari_… o JWT vigente>"
 }
 }
 }
}
```

**Producción con MCP local + túnel (Escenario C, D):**

Previo: túnel SSH activo + arrancar el MCP con `FALKORDB_HOST=localhost`, `INGEST_URL=https://apiariadne.kreoint.mx`. Luego:

```json
{
 "mcpServers": {
 "ariadnespecs": {
 "url": "http://localhost:8080/mcp"
 }
 }
}
```

> **Importante:** En desarrollo local y con túnel, el MCP debe estar corriendo antes de usar Cursor. En producción por URL, no hace falta arrancar nada localmente.

### Paso 5: Reiniciar Cursor

Cerrar y volver a abrir Cursor (o recargar la ventana) para que cargue el MCP.

### Paso 6: Verificar

En el chat de Cursor, al pedir algo como:
- "Lista los proyectos indexados en AriadneSpecs"
- "¿Qué impacto tiene modificar el componente X?"

La IA debería poder invocar las herramientas del MCP. Si aparecen errores de conexión, revisar [Troubleshooting](#8-troubleshooting).

---

## 5. Herramientas disponibles

| Herramienta | Uso típico |
|------------------------|--------------------------------------------------------|
| `list_known_projects` | Al inicio: mapear IDs de repos a nombres |
| `validate_before_edit` | **OBLIGATORIO** antes de editar componente o función |
| `sync_local_file` | Sincronización delta instantánea desde IDE/disco hacia FalkorDB (<50ms) |
| `detect_changes` | Blast radius pre-commit: símbolos afectados y riesgo antes de commit |
| `get_legacy_impact` | Ver qué se rompe si modificas un nodo |
| `get_contract_specs` | Props reales y firmas de contrato de un componente |
| `get_component_graph` | Árbol de dependencias (RENDERS, IMPORTS, USES_HOOK) |
| `get_functions_in_file`| Funciones y componentes en un archivo |
| `get_import_graph` | Imports y contenido estructural de un archivo |
| `get_file_content` | Contenido crudo de un archivo (requiere INGEST_URL) |
| `semantic_search` | Búsqueda híbrida con Ego-Graphs topológicos a 1 salto y expansión léxica ES↔EN |
| `get_project_analysis` | Diagnóstico, duplicados, reingeniería, código muerto, seguridad (ingest) |

---

## 6. Protocolo de uso (AGENTS.md)

Al trabajar en código legacy indexado, seguir el flujo SDD:

1. **Ejecutar `list_known_projects`** al inicio para obtener los `projectId`.
2. **Antes de editar:** Ejecutar `validate_before_edit` con el `nodeName`.
3. Si devuelve **"Nodo no encontrado"**: no proceder; verificar nombre o reindexar.
4. Para **componentes**: usar las props del contrato. Para **funciones**: usar path, descripción y endpoints que devuelve.
5. No inventar props ni firmas; usar solo lo que devuelve el grafo.
6. Código actual: `get_file_content` con el path.

La regla `.cursor/rules/legacy-sdd-validation.mdc` refuerza este protocolo en archivos `*.ts`, `*.tsx`, `*.js`, `*.jsx`.

---

## 7. Variables de entorno del MCP

El MCP usa **Streamable HTTP** en todas las configuraciones (puerto 8080, path /mcp).

| Variable | Descripción | Default |
|-----------------|-------------------------------------------|----------------|
| PORT | Puerto del servidor HTTP | `8080` |
| MCP_HTTP_PORT | Alias de PORT (legacy) | = PORT |
| FALKORDB_HOST | Host de FalkorDB | `localhost` |
| FALKORDB_PORT | Puerto de FalkorDB | `6379` |
| INGEST_URL | URL base del Ingest (get_file_content, etc.) | — |
| FALKORSPEC_INGEST_URL | Alias de INGEST_URL | = INGEST_URL |
| `MCP_HTTP_ALLOW_UNAUTHENTICATED` | **`1`** (solo dev local): permite `/mcp` sin Bearer | — |
| `ARIADNE_API_URL` | URL base del API Nest (default `http://localhost:3000`; en Docker suele ser `http://api:3000`) | Compose lo inyecta |

---

## 8. Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|-----------------|----------|
| "Connection refused" al usar herramientas | FalkorDB no levantado o inaccesible | Levantar `pnpm run dev:infra` o comprobar túnel SSH |
| "Nodo X no encontrado" | El nodo no existe en el grafo | Reindexar el repo (`POST /repositories/:id/resync`) |
| get_file_content falla | INGEST_URL no configurada o incorrecta | Definir INGEST_URL en env del MCP |
| Las herramientas no aparecen en Cursor | MCP no cargado | Verificar ruta en args, reiniciar Cursor |
| projectId desconocido | No se ha llamado list_known_projects | Ejecutar list_known_projects al inicio |

---

## 9. Referencias

- [AGENTS.md](../AGENTS.md) — Protocolo para agentes.
- [Manual de uso](../manual/README.md) — Puesta en marcha general.
- [Especificación MCP](/mcp_server_specs.md) — Detalle de herramientas (también en repo: `docs/notebooklm/mcp_server_specs.md`).
- [Esquema DB](db_schema.md) — Nodos y relaciones del grafo.
