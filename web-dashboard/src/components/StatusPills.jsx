import React from 'react';
import { Wifi, WifiOff, Activity, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

const pillStyles = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-gray-50 text-gray-600 border-gray-200',
  live: 'bg-purple-50 text-purple-700 border-purple-200',
};

function Pill({ kind = 'neutral', children, icon: Icon, pulse }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${pillStyles[kind]}`}>
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${kind === 'ok' ? 'bg-emerald-400' : kind === 'live' ? 'bg-purple-400' : 'bg-amber-400'}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${kind === 'ok' ? 'bg-emerald-500' : kind === 'live' ? 'bg-purple-500' : 'bg-amber-500'}`}></span>
        </span>
      )}
      {Icon && !pulse && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}

export function ConnectionStatus({ online }) {
  if (online === null || online === undefined) {
    return <Pill kind="neutral" icon={Clock}>Connecting...</Pill>;
  }
  return online ? (
    <Pill kind="ok" icon={Wifi}>Online</Pill>
  ) : (
    <Pill kind="error" icon={WifiOff}>Offline</Pill>
  );
}

export function LiveStatus({ isLive, label }) {
  if (!isLive) return null;
  return (
    <Pill kind="live" pulse>
      {label || 'Live'}
    </Pill>
  );
}

export function SessionStatus({ hasActiveSession, sessionId, eventName }) {
  if (!hasActiveSession) {
    return <Pill kind="neutral" icon={Clock}>No Active Session</Pill>;
  }
  return (
    <Pill kind="ok" icon={Activity}>
      {eventName || sessionId || 'Session Active'}
    </Pill>
  );
}

export function AttentionStatus({ needsAttention, count }) {
  if (!needsAttention) return null;
  return (
    <Pill kind="warning" icon={AlertTriangle} pulse>
      {count ? `${count} Attention` : 'Attention'}
    </Pill>
  );
}

export function AgentStatus({ agentCount, onlineCount }) {
  if (!agentCount) return null;
  const allOnline = onlineCount === agentCount;
  return (
    <Pill kind={allOnline ? 'ok' : 'warning'} icon={Activity}>
      {onlineCount}/{agentCount} Agents
    </Pill>
  );
}

export function QueueStatus({ queueSize }) {
  if (!queueSize || queueSize === 0) return null;
  return (
    <Pill kind="info" icon={Clock}>
      Queue: {queueSize}
    </Pill>
  );
}

export function HealthStatus({ status }) {
  const statusMap = {
    healthy: { kind: 'ok', icon: CheckCircle, label: 'Healthy' },
    degraded: { kind: 'warning', icon: AlertTriangle, label: 'Degraded' },
    critical: { kind: 'error', icon: AlertTriangle, label: 'Critical' },
  };
  const config = statusMap[status] || statusMap.healthy;
  return (
    <Pill kind={config.kind} icon={config.icon}>
      {config.label}
    </Pill>
  );
}

export default function StatusPills({ 
  online, 
  isLive, 
  hasActiveSession, 
  sessionId, 
  eventName,
  needsAttention,
  attentionCount,
  agentCount,
  onlineAgentCount,
  queueSize,
  healthStatus,
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <ConnectionStatus online={online} />
      <LiveStatus isLive={isLive} />
      {healthStatus && <HealthStatus status={healthStatus} />}
      <SessionStatus hasActiveSession={hasActiveSession} sessionId={sessionId} eventName={eventName} />
      <AttentionStatus needsAttention={needsAttention} count={attentionCount} />
      <AgentStatus agentCount={agentCount} onlineCount={onlineAgentCount} />
      <QueueStatus queueSize={queueSize} />
    </div>
  );
}
