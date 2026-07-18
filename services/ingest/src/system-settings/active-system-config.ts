import { setFalkorRuntimeOverrides } from 'ariadne-common';
import type { SystemSettingsEffective } from './system-settings.types';
import { buildSystemSettingsFromEnv } from './system-settings.defaults';

let active: SystemSettingsEffective = buildSystemSettingsFromEnv();

export function setActiveSystemConfig(config: SystemSettingsEffective): void {
  active = config;
  setFalkorRuntimeOverrides({
    shardByProject: config.falkor.shardByProject,
    shardByDomain: config.falkor.shardByDomain,
    autoDomainOverflow: config.falkor.autoDomainOverflow,
    graphNodeSoftLimit: config.falkor.graphNodeSoftLimit,
    debugCypher: config.falkor.debugCypher,
  });
}

export function getActiveSystemConfig(): SystemSettingsEffective {
  return active;
}
