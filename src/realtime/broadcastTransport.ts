import {
  IRealtimeTransport,
  RealtimeEnvelope,
  RealtimeEventType,
} from '../types';
import { createRealtimeEnvelope, RealtimeDeduplicator } from './transport';

type EventHandler<T = unknown> = (event: RealtimeEnvelope<T>) => void;

/**
 * High-performance cross-tab BroadcastChannel transport for sub-second sync (<50ms)
 * with zero external cloud dependencies. Fully operational offline.
 */
export class BroadcastChannelTransport implements IRealtimeTransport {
  private channelName: string;
  private channel: BroadcastChannel | null = null;
  private subscribers = new Map<RealtimeEventType, Set<EventHandler>>();
  private deduplicator = new RealtimeDeduplicator(1000);
  private localListeners = new Map<RealtimeEventType, Set<EventHandler>>();

  constructor(channelName = 'coffee_pos_realtime_bus') {
    this.channelName = channelName;
    this.initChannel();
  }

  private initChannel(): void {
    if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (messageEvent: MessageEvent<RealtimeEnvelope>) => {
          this.handleIncomingEnvelope(messageEvent.data);
        };
      } catch (err) {
        console.warn('[BroadcastTransport] Failed to initialize BroadcastChannel, falling back to local bus:', err);
        this.channel = null;
      }
    }
  }

  private handleIncomingEnvelope(envelope: RealtimeEnvelope): void {
    if (!envelope || !envelope.id || !envelope.type) return;

    // Filter duplicate events
    if (!this.deduplicator.trackAndCheckIsNew(envelope.id)) {
      return;
    }

    const handlers = this.subscribers.get(envelope.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(envelope);
        } catch (error) {
          console.error(`[BroadcastTransport] Error in subscriber for ${envelope.type}:`, error);
        }
      });
    }
  }

  public async publish<T>(
    event: Omit<RealtimeEnvelope<T>, 'id' | 'timestamp' | 'syncSource'>
  ): Promise<void> {
    const envelope = createRealtimeEnvelope<T>(
      event.type,
      event.payload,
      event.stationId,
      'broadcast_channel'
    );

    // Track locally so we don't duplicate when listening to our own bus
    this.deduplicator.trackAndCheckIsNew(envelope.id);

    // 1. Broadcast to other tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage(envelope);
      } catch (err) {
        console.error('[BroadcastTransport] Error posting message:', err);
      }
    }

    // 2. Dispatch to local subscribers in the current tab
    const handlers = this.subscribers.get(envelope.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(envelope as RealtimeEnvelope<any>);
        } catch (error) {
          console.error(`[BroadcastTransport] Error in local subscriber for ${envelope.type}:`, error);
        }
      });
    }
  }

  public subscribe<T>(
    eventType: RealtimeEventType,
    handler: (event: RealtimeEnvelope<T>) => void
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    const set = this.subscribers.get(eventType)!;
    const typedHandler = handler as EventHandler;
    set.add(typedHandler);

    return () => {
      set.delete(typedHandler);
      if (set.size === 0) {
        this.subscribers.delete(eventType);
      }
    };
  }

  public getTransportName(): 'broadcast_channel' {
    return 'broadcast_channel';
  }

  public close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.subscribers.clear();
    this.deduplicator.clear();
  }
}
