export type ToastItem = {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  createdAt: number;
};

export type BannerItem = {
  id: string;
  kind: 'info' | 'warning' | 'error';
  title: string;
  message?: string;
  sticky: boolean;
  createdAt: number;
  actions?: Array<{ label: string; actionId: string }>;
};

export type ActivityItem = {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  title: string;
  details?: any;
  createdAt: number;
  source: string;
};
