#!/usr/bin/env node
/**
 * @fileoverview Ariadne Link CLI (Standalone zero-dependency runner)
 *
 * Permite ejecutar `npx github:kreodevs/ariadne link` en cualquier máquina
 * sin necesidad de compilar TypeScript ni tener dependencias externas instaladas.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { execSync } from "node:child_process";

const CANONICAL_AGENTS_MD = `# AGENTS.md — Ariadne Codebase Intelligence

You have access to **Ariadne MCP** — a knowledge graph of this codebase powered by FalkorDB. It knows every component, function, route, model, import, and prop contract. Use it **before** writing code, not after.

## First steps (every session)

\`\`\`
list_known_projects()
\`\`\`

This gives you project IDs, repo names, and branches. Use the \`roots[].id\` (repo ID) as \`projectId\` in multi-root projects, not the project UUID. If you're editing a file, pass \`currentFilePath\` instead — the server infers the project.

## Core workflow

\`\`\`
1. list_known_projects() → get_sync_status(projectId)  [STOP if stale before large refactors]
2. semantic_search("what you're looking for") → find relevant code & Ego-Graphs
3. get_file_context(filePath) or get_file_content(path) → read the file
4. validate_before_edit(nodeName) → check impact + contract
5. Edit the code
6. detect_changes() → pre-commit blast radius check
\`\`\`

## Planned change workflow (multi-file / refactors)

\`\`\`
1. get_sync_status → resync if stale
2. Gate 1: get_modification_plan(userDescription) → filesToModify + changePlanTemplate
3. Build ChangePlan JSON (include referencePlan from Gate 1)
4. Gate 2: validate_change_plan → STOP if verdict === BLOCKED
5. Per symbol: validate_before_edit + get_references
6. Edit → detect_changes before commit
\`\`\`

## Rules

1. **Always validate before editing** — \`validate_before_edit\` on the node you're about to touch. No exceptions.
2. **Resolve projectId early** — Cache it. Every tool that accepts \`projectId\` works better with it.
3. **Route to cheap tools** — If you know the symbol/path, use \`get_file_content\` / \`get_definitions\` / \`get_references\` instead of general chat.
4. **Live Local Sync** — The Ariadne daemon watches your local file changes automatically in real time without requiring commit/push.
`;

function getGitRemoteOrigin() {
  try {
    const out = execSync("git remote get-url origin", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    return out.trim();
  } catch {
    return null;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let serverUrl = process.env.ARIADNE_URL || process.env.INGEST_URL || "http://localhost:3002";
  let token = process.env.ARIADNE_TOKEN || process.env.MCP_SECRET || "";
  let falkorHost = process.env.FALKORDB_HOST || "localhost";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--server" && args[i + 1]) {
      serverUrl = args[i + 1];
      i++;
    } else if (args[i] === "--token" && args[i + 1]) {
      token = args[i + 1];
      i++;
    } else if (args[i] === "--falkor" && args[i + 1]) {
      falkorHost = args[i + 1];
      i++;
    }
  }

  return { serverUrl: serverUrl.replace(/\/$/, ""), token, falkorHost };
}

export function runLink() {
  const cwd = process.cwd();
  const dirName = basename(cwd);
  const gitOrigin = getGitRemoteOrigin();
  const { serverUrl, token, falkorHost } = parseArgs();

  console.log(`\n🚀 \x1b[1m\x1b[36mAriadne Codebase Intelligence — Quick Setup\x1b[0m\n`);
  console.log(`📁 Directorio local:  \x1b[32m${cwd}\x1b[0m`);
  if (gitOrigin) {
    console.log(`🌿 Git Origin:        \x1b[34m${gitOrigin}\x1b[0m`);
  }
  console.log(`🔗 Servidor Ariadne:  \x1b[33m${serverUrl}\x1b[0m\n`);

  // 1. Configurar .cursor/mcp.json
  const cursorDir = join(cwd, ".cursor");
  const mcpJsonPath = join(cursorDir, "mcp.json");

  if (!existsSync(cursorDir)) {
    mkdirSync(cursorDir, { recursive: true });
  }

  let mcpConfig = { mcpServers: {} };
  if (existsSync(mcpJsonPath)) {
    try {
      mcpConfig = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
    } catch {
      // Usar estructura base
    }
  }

  const isRemote = !serverUrl.includes("localhost") && !serverUrl.includes("127.0.0.1");

  if (isRemote) {
    // Modo Remoto (Dokploy / Servidor Cloud):
    // FalkorDB no está expuesto a internet. Cursor se conecta vía HTTP al servicio mcp-ariadne
    const cleanUrl = serverUrl.replace(/\/mcp\/?$/, "");
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    mcpConfig.mcpServers.ariadne = {
      url: `${cleanUrl}/mcp`,
      ...(token ? { headers } : {}),
    };
    console.log(`✅ \x1b[32mConfigurado .cursor/mcp.json\x1b[0m (conexión HTTP remota a ${cleanUrl}/mcp)`);
  } else {
    // Modo Local (Ariadne corriendo en localhost)
    const mcpEnv = {
      INGEST_URL: serverUrl,
      FALKORDB_HOST: falkorHost,
    };
    if (token) {
      mcpEnv.ARIADNE_TOKEN = token;
    }

    let mcpCommand = "ariadne-mcp";
    let mcpArgs = ["--stdio"];
    try {
      execSync("which ariadne-mcp", { stdio: "ignore" });
    } catch {
      mcpCommand = "npx";
      mcpArgs = ["-y", "@kreodevs/ariadne", "--stdio"];
    }

    mcpConfig.mcpServers.ariadne = {
      command: mcpCommand,
      args: mcpArgs,
      env: mcpEnv,
    };
    console.log(`✅ \x1b[32mConfigurado .cursor/mcp.json\x1b[0m (servidor STDIO local con auto-watcher)`);
  }

  writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + "\n", "utf-8");

  // 2. Colocar AGENTS.md si no existe
  const agentsMdPath = join(cwd, "AGENTS.md");
  if (!existsSync(agentsMdPath)) {
    writeFileSync(agentsMdPath, CANONICAL_AGENTS_MD, "utf-8");
    console.log(`✅ \x1b[32mCreado AGENTS.md\x1b[0m (instrucciones canónicas para Cursor)`);
  } else {
    console.log(`ℹ️  AGENTS.md ya existe en el proyecto (no se sobreescribió).`);
  }

  // 3. Crear .ariadne/config.json
  const ariadneDir = join(cwd, ".ariadne");
  if (!existsSync(ariadneDir)) {
    mkdirSync(ariadneDir, { recursive: true });
  }
  const configJsonPath = join(ariadneDir, "config.json");
  const ariadneConfig = {
    projectName: dirName,
    gitOrigin: gitOrigin || undefined,
    serverUrl,
    linkedAt: new Date().toISOString(),
  };
  writeFileSync(configJsonPath, JSON.stringify(ariadneConfig, null, 2) + "\n", "utf-8");
  console.log(`✅ \x1b[32mRegistrado .ariadne/config.json\x1b[0m`);

  console.log(`\n🎉 \x1b[1m\x1b[32m¡Listo! Tu proyecto ahora está conectado a Ariadne.\x1b[0m`);
  console.log(`
👉 \x1b[1mSiguientes pasos:\x1b[0m
   1. Abre Cursor en este proyecto.
   2. Cursor levantará el servidor Ariadne y el \x1b[36mLive Watcher\x1b[0m automáticamente en segundo plano.
   3. Pídele al agente en el chat de Cursor: \x1b[33m"list_known_projects()"\x1b[0m o haz cualquier pregunta sobre tu arquitectura.
`);
}

runLink();
