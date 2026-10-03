import type { IRealtimeTransport, RealtimeEnvelope, RealtimeEventType } from '../types';

export type { IRealtimeTransport, RealtimeEnvelope, RealtimeEventType };

/**
 * Creates a standard envelope for realtime event distribution.
 */
export function createRealtimeEnvelope<T>(
  type: RealtimeEventType,
  payload: T,
  stationId: string,
  syncSource: 'supabase' | 'broadcast_channel' | 'local_memory' = 'broadcast_channel'
): RealtimeEnvelope<T> {
  const randomId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return {
    id: randomId,
    type,
    timestamp: new Date().toISOString(),
    stationId,
    payload,
    syncSource,
  };
}

/**
 * Utility to manage deduplication of realtime events.
 */
export class RealtimeDeduplicator {
  private seenIds = new Set<string>();
  private idQueue: string[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 500) {
    this.maxCapacity = maxCapacity;
  }

  /**
   * Returns true if event is NEW (not seen before), and marks it as seen.
   * Returns false if event is a duplicate.
   */
  public trackAndCheckIsNew(id: string): boolean {
    if (this.seenIds.has(id)) {
      return false;
    }

    this.seenIds.add(id);
    this.idQueue.push(id);

    if (this.idQueue.length > this.maxCapacity) {
      const oldestId = this.idQueue.shift();
      if (oldestId) {
        this.seenIds.delete(oldestId);
      }
    }

    return true;
  }

  public clear(): void {
    this.seenIds.clear();
    this.idQueue = [];
  }
}
