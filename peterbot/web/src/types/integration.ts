// API returns dates as strings (JSON serialization)
export interface ApiConnectedApp {
  id: string;
  provider: string;
  composioEntityId: string;
  accountEmail: string | null;
  enabled: boolean;
  connectedAt: string;
  lastUsedAt: string | null;
}

export interface ApiProvider {
  provider: string;
  label: string;
  icon: string;
  connected: boolean;
  app: ApiConnectedApp | null;
  required: boolean;
  category: string;
  description: string;
  enabled: boolean;
}

export interface IntegrationsResponse {
  configured: boolean;
  providers: ApiProvider[];
  lastSyncedAt: string | null;
}
