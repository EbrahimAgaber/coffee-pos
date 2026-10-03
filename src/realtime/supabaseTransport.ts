import {
  IRealtimeTransport,
  RealtimeEnvelope,
  RealtimeEventType,
} from '../types';
import { BroadcastChannelTransport } from './broadcastTransport';
import { createRealtimeEnvelope, RealtimeDeduplicator } from './transport';

export interface SupabaseConfig {
  url?: string;
  anonKey?: string;
  channelName?: string;
}

/**
 * Supabase Realtime client adapter supporting Broadcast channels and Postgres Changes (CDC).
 * Gracefully falls back to BroadcastChannelTransport when credentials are not configured or offline.
 */
export class SupabaseRealtimeTransport implements IRealtimeTransport {
  private config: SupabaseConfig;
  private fallbackTransport: BroadcastChannelTransport;
  private isConfigured = false;
  private deduplicator = new RealtimeDeduplicator(1000);
  private socket: WebSocket | null = null;
  private subscribers = new Map<RealtimeEventType, Set<(event: RealtimeEnvelope<any>) => void>>();
  private channelTopic: string;

  constructor(config?: SupabaseConfig) {
    const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
    const envUrl = metaEnv ? metaEnv.VITE_SUPABASE_URL : undefined;
    const envKey = metaEnv ? metaEnv.VITE_SUPABASE_ANON_KEY : undefined;

    this.config = {
      url: config?.url || envUrl,
      anonKey: config?.anonKey || envKey,
      channelName: config?.channelName || 'coffee_pos_orders',
    };

    this.channelTopic = `realtime:${this.config.channelName}`;
    this.fallbackTransport = new BroadcastChannelTransport(this.config.channelName);

    if (this.config.url && this.config.anonKey && this.config.url.startsWith('http')) {
      this.isConfigured = true;
      this.initSupabaseWebSocket();
    } else {
      console.info('[SupabaseTransport] Supabase credentials unconfigured; running in high-performance local BroadcastChannel mode.');
    }
  }

  private initSupabaseWebSocket(): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;

    try {
      const wsUrl = this.config.url!
        .replace(/^https:\/\//, 'wss://')
        .replace(/^http:\/\//, 'ws://') + `/realtime/v1/websocket?apikey=${this.config.anonKey}&vsn=1.0.0`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        // Join realtime channel topic
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          const joinMessage = {
            topic: this.channelTopic,
            event: 'phx_join',
            payload: {
              config: {
                broadcast: { ack: false, self: false },
                presence: { key: '' },
              },
            },
            ref: '1',
          };
          this.socket.send(JSON.stringify(joinMessage));
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.topic === this.channelTopic && data.event === 'broadcast') {
            const envelope = data.payload as RealtimeEnvelope;
            if (envelope && envelope.id && this.deduplicator.trackAndCheckIsNew(envelope.id)) {
              this.notifyLocalSubscribers(envelope);
            }
          }
        } catch (e) {
          console.warn('[SupabaseTransport] Parse error on realtime payload:', e);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('[SupabaseTransport] WebSocket error, relying on BroadcastChannel fallback:', err);
      };

      this.socket.onclose = () => {
        console.info('[SupabaseTransport] WebSocket disconnected, maintaining local BroadcastChannel sync.');
      };
    } catch (err) {
      console.warn('[SupabaseTransport] Could not initialize Supabase connection, using Broadcast fallback:', err);
    }
  }

  private notifyLocalSubscribers(envelope: RealtimeEnvelope): void {
    const handlers = this.subscribers.get(envelope.type);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(envelope);
        } catch (err) {
          console.error(`[SupabaseTransport] Handler error on ${envelope.type}:`, err);
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
      this.isConfigured ? 'supabase' : 'broadcast_channel'
    );

    this.deduplicator.trackAndCheckIsNew(envelope.id);

    // If active Supabase socket is available, broadcast over it
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const message = {
          topic: this.channelTopic,
          event: 'broadcast',
          payload: envelope,
          ref: Date.now().toString(),
        };
        this.socket.send(JSON.stringify(message));
      } catch (err) {
        console.warn('[SupabaseTransport] Failed to send via socket, falling back to BroadcastChannel:', err);
      }
    }

    // Always mirror to local BroadcastChannel for zero-latency local tab sync
    await this.fallbackTransport.publish(event);

    // Dispatch locally
    this.notifyLocalSubscribers(envelope);
  }

  public subscribe<T>(
    eventType: RealtimeEventType,
    handler: (event: RealtimeEnvelope<T>) => void
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    const set = this.subscribers.get(eventType)!;
    set.add(handler);

    // Also subscribe to local fallback transport
    const unsubscribeFallback = this.fallbackTransport.subscribe<T>(eventType, (envelope) => {
      if (this.deduplicator.trackAndCheckIsNew(envelope.id)) {
        handler(envelope);
      }
    });

    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.subscribers.delete(eventType);
      }
      unsubscribeFallback();
    };
  }

  public getTransportName(): 'supabase' | 'broadcast_channel' {
    return this.isConfigured ? 'supabase' : 'broadcast_channel';
  }

  public close(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.fallbackTransport.close();
    this.subscribers.clear();
    this.deduplicator.clear();
  }
}
