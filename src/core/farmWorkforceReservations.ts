import { farmOf, pinnedFarmHarvestYield, storageRemaining } from './farmBusiness';
import { farmCropDefOrNull } from './registry';
import type { FarmWorkerId, GameState } from './types';
import type { FarmhandWorkKind } from './farmWorkforce';

export interface ReservedWorkerJob {
  workerId: FarmWorkerId;
  kind: FarmhandWorkKind;
  cropId?: string;
  targetPlotUids: number[];
}

interface Claim { plots: Set<number>; seeds: Record<string, number>; storage: number; storageByPlot: Map<number, number> }

/** Runtime-only, deterministic resource claims shared by every field actor. */
export class FarmWorkforceReservationLedger {
  private readonly byWorker = new Map<FarmWorkerId, Claim>();

  isClaimed(uid: number): boolean { return [...this.byWorker.values()].some((claim) => claim.plots.has(uid)); }
  claimedByOther(workerId: FarmWorkerId, uid: number): boolean { return [...this.byWorker.entries()].some(([id, claim]) => id !== workerId && claim.plots.has(uid)); }
  heldSeeds(cropId: string, except?: FarmWorkerId): number { return [...this.byWorker.entries()].filter(([id]) => id !== except).reduce((total, [, claim]) => total + (claim.seeds[cropId] ?? 0), 0); }
  heldStorage(except?: FarmWorkerId): number { return [...this.byWorker.entries()].filter(([id]) => id !== except).reduce((total, [, claim]) => total + claim.storage, 0); }

  reserve(state: GameState, job: ReservedWorkerJob): ReservedWorkerJob {
    if (!job || !Array.isArray(job.targetPlotUids) || !['mara-bell', 'eliot-reyes'].includes(job.workerId)) return { ...job, targetPlotUids: [] };
    const seeds: Record<string, number> = {}; let storage = 0; const storageByPlot = new Map<number, number>(); const seen = new Set<number>();
    const targets = job.targetPlotUids.filter((uid) => Number.isInteger(uid) && !seen.has(uid) && (seen.add(uid), true)).filter((uid) => {
      if (this.claimedByOther(job.workerId, uid)) return false;
      const plot = state.plots.find((candidate) => candidate.uid === uid); if (!plot) return false;
      if (job.kind === 'plant') {
        const cropId = String(job.cropId ?? ''); if (!cropId) return false;
        const used = seeds[cropId] ?? 0;
        if ((farmOf(state).seeds[cropId] ?? 0) - this.heldSeeds(cropId, job.workerId) <= used) return false;
        seeds[cropId] = used + 1;
      }
      if (job.kind === 'harvest') {
        if (!plot.crop) return false;
        const def = farmCropDefOrNull(plot.crop.defId); if (!def) return false;
        const need = pinnedFarmHarvestYield(plot.crop) * def.storageUnitsPerItem;
        if (storageRemaining(state) - this.heldStorage(job.workerId) < storage + need) return false;
        storage += need; storageByPlot.set(uid, need);
      }
      return true;
    });
    this.byWorker.set(job.workerId, { plots: new Set(targets), seeds, storage, storageByPlot });
    return { ...job, targetPlotUids: targets };
  }

  consume(state: GameState, workerId: FarmWorkerId, kind: FarmhandWorkKind, plotUid: number, cropId?: string): void {
    const claim = this.byWorker.get(workerId); if (!claim) return;
    if (kind === 'harvest') { const amount = claim.storageByPlot.get(plotUid) ?? 0; claim.storage = Math.max(0, claim.storage - amount); claim.storageByPlot.delete(plotUid); }
    if (kind === 'plant' && cropId) claim.seeds[cropId] = Math.max(0, (claim.seeds[cropId] ?? 0) - 1);
    claim.plots.delete(plotUid);
  }

  release(workerId: FarmWorkerId): void { this.byWorker.delete(workerId); }
  releaseAll(): void { this.byWorker.clear(); }
}
