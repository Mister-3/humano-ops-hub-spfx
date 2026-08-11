import type { IEndToEndGroup } from '../../types';
import { normalizeEndToEndText } from './endToEndDomain.ts';

export interface IEndToEndFilters {
  search: string;
  severity: string;
  stage: string;
  flow: string;
  lotType: string;
  channel: string;
  modality: string;
  escalated: string;
  distro: string;
  recurrent: string;
  dataError: string;
  leader: string;
  priority: '' | 'soon' | 'reconciliation' | 'officeAutomatic';
}

export const EMPTY_END_TO_END_FILTERS: IEndToEndFilters = {
  search: '', severity: '', stage: '', flow: '', lotType: '', channel: '',
  modality: '', escalated: '', distro: '', recurrent: '', dataError: '', leader: '',
  priority: ''
};

export const applyEndToEndFilters = (
  groups: ReadonlyArray<IEndToEndGroup>,
  filters: IEndToEndFilters
): IEndToEndGroup[] => {
  const matches = groups.filter((group) => {
    const search = normalizeEndToEndText(filters.search);
    const matchesSearch = !search || normalizeEndToEndText(group.radicacion).includes(search);
    const matchesSeverity = !filters.severity ||
      (filters.severity === 'critica'
        ? group.severity === 'rojo' || group.severity === 'naranja'
        : group.severity === filters.severity);
    const matchesStage = !filters.stage || group.stage === filters.stage;
    const matchesFlow = !filters.flow || group.flow === filters.flow;
    const matchesLot = !filters.lotType || group.tipoLote === filters.lotType;
    const matchesChannel = !filters.channel || group.canal === filters.channel;
    const matchesModality = !filters.modality || group.modalidad === filters.modality;
    const matchesEscalated = !filters.escalated || String(group.escalado) === filters.escalated;
    const matchesDistro = !filters.distro || group.estadoDistro === filters.distro;
    const matchesRecurrent = !filters.recurrent || String(group.reincidenteHoy) === filters.recurrent;
    const matchesError = !filters.dataError || String(group.hasDataError) === filters.dataError;
    const matchesLeader = !filters.leader || group.director === filters.leader || group.gerente === filters.leader;
    const matchesPriority = !filters.priority ||
      (filters.priority === 'soon'
        ? !group.completed && (group.remainingMinutes ?? -1) >= 0
        : filters.priority === 'reconciliation'
          ? group.reconciliationRequired
          : normalizeEndToEndText(group.canal) === 'oficina virtual' &&
            normalizeEndToEndText(group.modalidad) === 'automatica' && !group.completed);
    return matchesSearch && matchesSeverity && matchesStage && matchesFlow && matchesLot &&
      matchesChannel && matchesModality && matchesEscalated && matchesDistro &&
      matchesRecurrent && matchesError && matchesLeader && matchesPriority;
  });
  return filters.priority === 'soon' ? matches.slice(0, 10) : matches;
};
