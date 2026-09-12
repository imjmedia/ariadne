/**
 * @fileoverview Lectura de flags C4 desde system_settings (Ajustes → Sistema).
 */
import { getActiveSystemConfig } from '../system-settings/active-system-config';
import type { SystemC4Effective } from '../system-settings/system-settings.types';

export function getC4Settings(): SystemC4Effective {
  return getActiveSystemConfig().c4;
}
