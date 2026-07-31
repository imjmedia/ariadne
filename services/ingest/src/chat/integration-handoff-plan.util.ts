/** Re-export handoff plan helpers from ariadne-common (ingest Cypher layer uses path/component terms). */
export {
  buildIntegrationHandoffSearchQueries,
  integrationHandoffComponentTerms,
  integrationHandoffPathPatternTerms,
  mergeIntegrationHandoffFileCandidates,
  scoreIntegrationHandoffFile,
} from 'ariadne-common';
