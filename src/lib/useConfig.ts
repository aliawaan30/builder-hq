import { useMemo } from 'react';
import { useData } from './data';
import type { Member, Offer, Stage, WorkstreamDef } from './types';

const FALLBACK_COLOR = '#8792A2';

/** Current team, workstreams and stages, with lookups. */
export function useConfig() {
  const { config } = useData();
  return useMemo(
    () => ({
      ...config,
      memberOf: (name: string): Member | undefined => config.team.find((m) => m.name === name),
      ws: (id: string): WorkstreamDef => config.workstreams.find((w) => w.id === id) ?? { id, label: 'No workstream', color: FALLBACK_COLOR },
      stage: (offer: Offer, id: string): Stage | undefined => config.stages[offer].find((s) => s.id === id),
      colorOf: (name: string): string => config.team.find((m) => m.name === name)?.color ?? FALLBACK_COLOR,
    }),
    [config],
  );
}
