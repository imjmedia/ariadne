/**
 * @fileoverview Paquete **ariadne-common**: tipos y utilidades compartidas para FalkorDB, Cypher y rutas de grafo
 * usadas por **ingest**, pipelines históricos y **mcp-ariadne**. Punto único de verdad para nombres de grafo,
 * sharding por proyecto/dominio y helpers de batch Cypher.
 *
 * @module ariadne-common
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */

export { escapeCypherString, cypherSafe } from './cypher.js';
export {
  BLOCKED_CYPHER_CLAUSES,
  CypherGuardError,
  appendLimitIfMissing,
  guardCypherQuery,
  injectProjectScope,
  queryHasLimit,
  queryReferencesProjectId,
  validateReadOnlyCypher,
  type BlockedCypherClause,
  type CypherGuardResult,
  type GuardCypherOptions,
} from './cypher-guard.js';
export {
  buildDetectChangesResult,
  classifySymbolImpact,
  gitDiffCommand,
  parseChangedFilesFromDiff,
  parseDiffMode,
  parseDiffSymbols,
  type DetectChangesResult,
  type DetectChangesSummary,
  type DiffMode,
  type ParsedDiffSymbols,
  type SymbolChangeKind,
  type SymbolImpactRow,
} from './diff-impact.js';
export {
  GRAPH_NAME,
  SHADOW_GRAPH_NAME,
  shadowGraphNameForSession,
  getFalkorConfig,
  graphNameForProject,
  isProjectShardingEnabled,
  externalGraphName,
  isExternalGraphRoutingEnabled,
  getGraphNodeSoftLimit,
  isEnvDomainShardingEnabled,
  isAutoDomainOverflowEnabled,
  isFalkorDebugCypherEnabled,
  setFalkorRuntimeOverrides,
  effectiveShardMode,
  domainSegmentFromRepoPath,
  listGraphNamesForProjectRouting,
  type FalkorConfig,
  type FalkorRuntimeOverrides,
  type FalkorShardMode,
  type GraphNameForProjectOptions,
} from './falkor.js';
export {
  type ResolvedCallInfo,
  type ParsedFileMinimal,
  type ImportInfoMinimal,
  type UnresolvedCallMinimal,
} from './graph-types.js';
export {
  buildExportsMap,
  resolveCrossFileCalls,
  runCypherBatch,
  type GraphClient,
} from './graph-utils.js';
export {
  FALKOR_EMBEDDABLE_NODE_LABELS,
  FALKOR_DOCUMENTATION_DOC_LABELS,
  type FalkorEmbeddableLabel,
  type FalkorDocumentationDocLabel,
} from './graph-labels.js';
export { createLogger, extractRequestId } from './logger.js';
export type { Logger } from 'pino';
export type { ChatIntent, ChatIntentRouteResult } from './chat-intent.types.js';
export { CHAT_INTENTS } from './chat-intent.types.js';
export {
  SCHEMA_MODEL_SOURCES,
  wantsArchitectureDomainQuestion,
  wantsReengineeringQuestion,
  wantsSchemaDatabaseQuestion,
} from './chat-schema-question.util.js';
export {
  LlmContextLengthError,
  buildLlmContextLengthMessage,
  extractOpenRouterProviderMessage,
  isContextLengthProviderMessage,
  isLlmContextLengthError,
  mapOpenRouterHttpError,
  parseContextLengthFromMessage,
} from './llm-openrouter-error.util.js';
