import { getAgentState, setAgentState } from './db';

const MAINTENANCE_KEY = 'site_maintenance_mode';

export function isMaintenanceEnabled(): boolean {
  return getAgentState(MAINTENANCE_KEY) === 'on';
}

export function setMaintenanceEnabled(enabled: boolean): void {
  setAgentState(MAINTENANCE_KEY, enabled ? 'on' : 'off');
}
