'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Cloud,
  Cpu,
  Database,
  Globe2,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react';

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE';

type Service = {
  id: string;
  name: string;
  provider: string;
  status: HealthStatus;
  uptime: number;
  latency: number;
  previousLatency: number;
  icon: LucideIcon;
};

type ClientPlatform = {
  id: string;
  name: string;
  product: string;
  status: HealthStatus;
  responseTime: number;
  previousResponseTime: number;
  activeUsers: number;
  previousActiveUsers: number;
  uptime: number;
  lastDeployment: string;
};

type ActivityEvent = {
  id: string;
  title: string;
  description: string;
  type: 'SUCCESS' | 'WARNING' | 'INFO';
  createdAt: Date;
};

const initialServices: Service[] = [
  {
    id: 'production-api',
    name: 'Production API',
    provider: 'Syntra Grid API',
    status: 'HEALTHY',
    uptime: 99.99,
    latency: 84,
    previousLatency: 88,
    icon: Globe2,
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL Database',
    provider: 'Neon',
    status: 'HEALTHY',
    uptime: 99.99,
    latency: 13,
    previousLatency: 12,
    icon: Database,
  },
  {
    id: 'cloudinary',
    name: 'Media Storage',
    provider: 'Cloudinary',
    status: 'HEALTHY',
    uptime: 99.97,
    latency: 47,
    previousLatency: 44,
    icon: HardDrive,
  },
  {
    id: 'vercel',
    name: 'Application Hosting',
    provider: 'Vercel',
    status: 'HEALTHY',
    uptime: 99.98,
    latency: 72,
    previousLatency: 76,
    icon: Cloud,
  },
  {
    id: 'email',
    name: 'Transactional Email',
    provider: 'Resend',
    status: 'HEALTHY',
    uptime: 99.94,
    latency: 109,
    previousLatency: 104,
    icon: Zap,
  },
  {
    id: 'background-workers',
    name: 'Background Workers',
    provider: 'Syntra Grid Jobs',
    status: 'DEGRADED',
    uptime: 98.82,
    latency: 218,
    previousLatency: 196,
    icon: Cpu,
  },
];

const initialPlatforms: ClientPlatform[] = [
  {
    id: 'esteem',
    name: 'Esteem Learning Centre',
    product: 'School Management Platform',
    status: 'HEALTHY',
    responseTime: 118,
    previousResponseTime: 124,
    activeUsers: 86,
    previousActiveUsers: 82,
    uptime: 99.99,
    lastDeployment: '2 hours ago',
  },
  {
    id: 'homewise',
    name: 'HomeWise',
    product: 'Property Technology Platform',
    status: 'HEALTHY',
    responseTime: 93,
    previousResponseTime: 89,
    activeUsers: 241,
    previousActiveUsers: 236,
    uptime: 99.97,
    lastDeployment: '18 minutes ago',
  },
  {
    id: 'meldex',
    name: 'Meldex Industries',
    product: 'Corporate Website and CMS',
    status: 'HEALTHY',
    responseTime: 79,
    previousResponseTime: 83,
    activeUsers: 12,
    previousActiveUsers: 10,
    uptime: 100,
    lastDeployment: '1 day ago',
  },
];

const initialEvents: ActivityEvent[] = [
  {
    id: 'event-1',
    title: 'Deployment completed',
    description: 'RentWise production deployment completed successfully.',
    type: 'SUCCESS',
    createdAt: new Date(Date.now() - 18 * 60_000),
  },
  {
    id: 'event-2',
    title: 'Worker latency increased',
    description: 'Background processing exceeded the 200 ms warning threshold.',
    type: 'WARNING',
    createdAt: new Date(Date.now() - 34 * 60_000),
  },
  {
    id: 'event-3',
    title: 'Database backup completed',
    description: 'The scheduled PostgreSQL backup completed successfully.',
    type: 'SUCCESS',
    createdAt: new Date(Date.now() - 72 * 60_000),
  },
  {
    id: 'event-4',
    title: 'Health check completed',
    description: 'All client production endpoints responded successfully.',
    type: 'INFO',
    createdAt: new Date(Date.now() - 96 * 60_000),
  },
];

const generatedEvents = [
  {
    title: 'Health checks completed',
    description: 'All monitored production endpoints responded successfully.',
    type: 'SUCCESS' as const,
  },
  {
    title: 'Traffic increased',
    description: 'Active platform usage increased above the recent average.',
    type: 'INFO' as const,
  },
  {
    title: 'Database latency recovered',
    description: 'Neon PostgreSQL response time returned to its normal range.',
    type: 'SUCCESS' as const,
  },
  {
    title: 'Worker queue warning',
    description: 'The background job queue briefly exceeded its warning level.',
    type: 'WARNING' as const,
  },
  {
    title: 'Monzo synchronisation completed',
    description: 'The latest business transactions were synchronised.',
    type: 'SUCCESS' as const,
  },
  {
    title: 'Deployment status checked',
    description: 'All active Vercel deployments are operating normally.',
    type: 'INFO' as const,
  },
];

function randomBetween(minimum: number, maximum: number) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function fluctuate(
  current: number,
  change: number,
  minimum: number,
  maximum: number,
) {
  return clamp(
    current + randomBetween(-change, change),
    minimum,
    maximum,
  );
}

function createHistory(length: number, centre: number, variation: number) {
  return Array.from({ length }, () =>
    fluctuate(centre, variation, centre - variation, centre + variation),
  );
}

export default function MonitoringPage() {
  const [services, setServices] = useState(initialServices);
  const [platforms, setPlatforms] = useState(initialPlatforms);
  const [events, setEvents] = useState(initialEvents);

  const [latencyHistory, setLatencyHistory] = useState(() =>
    createHistory(18, 94, 12),
  );

  const [trafficHistory, setTrafficHistory] = useState(() =>
    createHistory(18, 339, 35),
  );

  const [lastCheckedAt, setLastCheckedAt] = useState(() => new Date());
  const [clock, setClock] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState(true);

  const updateTelemetry = useCallback(() => {
    setServices((currentServices) =>
      currentServices.map((service) => {
        const previousLatency = service.latency;

        const latency =
          service.id === 'background-workers'
            ? fluctuate(service.latency, 24, 165, 275)
            : fluctuate(service.latency, 10, 8, 145);

        let status: HealthStatus = 'HEALTHY';

        if (service.id === 'background-workers' && latency >= 205) {
          status = 'DEGRADED';
        }

        if (latency >= 270) {
          status = 'OFFLINE';
        }

        const uptimeChange = Math.random() > 0.65 ? -0.01 : 0;

        return {
          ...service,
          previousLatency,
          latency,
          status,
          uptime: clamp(
            Number((service.uptime + uptimeChange).toFixed(2)),
            97.5,
            100,
          ),
        };
      }),
    );

    setPlatforms((currentPlatforms) =>
      currentPlatforms.map((platform) => {
        const previousResponseTime = platform.responseTime;
        const previousActiveUsers = platform.activeUsers;

        const responseTime = fluctuate(
          platform.responseTime,
          13,
          54,
          195,
        );

        const activeUsers = fluctuate(
          platform.activeUsers,
          platform.id === 'rentwise' ? 12 : 6,
          1,
          platform.id === 'rentwise' ? 320 : 150,
        );

        return {
          ...platform,
          previousResponseTime,
          previousActiveUsers,
          responseTime,
          activeUsers,
          status: responseTime > 175 ? 'DEGRADED' : 'HEALTHY',
        };
      }),
    );

    setLatencyHistory((current) => {
      const latest = current.at(-1) ?? 94;
      return [...current.slice(1), fluctuate(latest, 9, 65, 130)];
    });

    setTrafficHistory((current) => {
      const latest = current.at(-1) ?? 339;
      return [...current.slice(1), fluctuate(latest, 28, 260, 460)];
    });

    setLastCheckedAt(new Date());
  }, []);

  useEffect(() => {
    const clockInterval = window.setInterval(() => {
      setClock(new Date());
    }, 1000);

    return () => {
      window.clearInterval(clockInterval);
    };
  }, []);

  useEffect(() => {
    if (!liveUpdates) {
      return;
    }

    const telemetryInterval = window.setInterval(() => {
      updateTelemetry();
    }, 2800);

    return () => {
      window.clearInterval(telemetryInterval);
    };
  }, [liveUpdates, updateTelemetry]);

  useEffect(() => {
    if (!liveUpdates) {
      return;
    }

    const eventInterval = window.setInterval(() => {
      const template =
        generatedEvents[randomBetween(0, generatedEvents.length - 1)];

      const event: ActivityEvent = {
        id: crypto.randomUUID(),
        ...template,
        createdAt: new Date(),
      };

      setEvents((current) => [event, ...current].slice(0, 7));
    }, 11_000);

    return () => {
      window.clearInterval(eventInterval);
    };
  }, [liveUpdates]);

  const summary = useMemo(() => {
    const averageLatency = Math.round(
      services.reduce((total, service) => total + service.latency, 0) /
        Math.max(services.length, 1),
    );

    const averageUptime =
      services.reduce((total, service) => total + service.uptime, 0) /
      Math.max(services.length, 1);

    const totalActiveUsers = platforms.reduce(
      (total, platform) => total + platform.activeUsers,
      0,
    );

    const degradedServices = services.filter(
      (service) => service.status !== 'HEALTHY',
    ).length;

    const healthScore = clamp(
      averageUptime -
        degradedServices * 0.14 -
        Math.max(0, averageLatency - 110) * 0.002,
      95,
      100,
    );

    return {
      averageLatency,
      averageUptime,
      totalActiveUsers,
      degradedServices,
      healthScore,
    };
  }, [platforms, services]);

  async function refreshStatus() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });

    updateTelemetry();

const refreshEvent: ActivityEvent = {
  id: crypto.randomUUID(),
  title: 'Manual health check completed',
  description:
    'Syntra Grid refreshed all service and client platform statuses.',
  type: 'SUCCESS',
  createdAt: new Date(),
};

setEvents((current) => [refreshEvent, ...current].slice(0, 7));
    setRefreshing(false);
  }

  return (
    <main className="space-y-6 pb-10">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#A87B1B]">
            <Activity className="h-4 w-4" />
            Live operations centre
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1020]">
            Monitoring
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5A6173]">
            Live infrastructure telemetry, platform availability and operational
            events across Syntra Grid and every connected client system.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#14B8A6]/25 bg-[#14B8A6]/[0.06] px-4 text-sm font-bold text-[#0D9488]">
            <span className="relative flex h-2.5 w-2.5">
              {liveUpdates && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14B8A6] opacity-60" />
              )}

              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  liveUpdates ? 'bg-[#14B8A6]' : 'bg-slate-400'
                }`}
              />
            </span>

            {liveUpdates ? 'Live monitoring' : 'Live updates paused'}
          </div>

          <button
            type="button"
            onClick={() => setLiveUpdates((current) => !current)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#0B1020]/10 bg-white px-4 text-sm font-bold text-[#475569] transition hover:bg-[#F8FAFC] hover:text-[#0B1020]"
          >
            {liveUpdates ? 'Pause' : 'Resume'}
          </button>

          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={refreshing}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1020] px-5 text-sm font-bold text-white transition hover:bg-[#151D34] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />

            {refreshing ? 'Checking systems' : 'Refresh status'}
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#0B1020]/[0.07] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#64748B]">
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            Last checked {formatRelativeTime(lastCheckedAt, clock)}
          </span>

          <span className="inline-flex items-center gap-2">
            <Server className="h-4 w-4" />
            {services.length} infrastructure services
          </span>

          <span className="inline-flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            {platforms.length} client platforms
          </span>
        </div>

        <p className="font-mono text-xs font-semibold text-[#64748B]">
          {formatClock(clock)}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LiveMetricCard
          label="System health"
          value={`${summary.healthScore.toFixed(2)}%`}
          detail={
            summary.degradedServices === 0
              ? 'All systems operational'
              : `${summary.degradedServices} service warning`
          }
          change={summary.degradedServices === 0 ? 0.03 : -0.06}
          icon={ShieldCheck}
          iconClassName="bg-[#14B8A6]/10 text-[#0D9488]"
        />

        <LiveMetricCard
          label="Average latency"
          value={`${summary.averageLatency} ms`}
          detail="Across infrastructure services"
          change={summary.averageLatency < 105 ? -4.7 : 6.2}
          invertChange
          icon={Wifi}
          iconClassName="bg-[#1E4E8C]/10 text-[#1E4E8C]"
        />

        <LiveMetricCard
          label="Active users"
          value={summary.totalActiveUsers.toLocaleString('en-GB')}
          detail="Across connected platforms"
          change={3.8}
          icon={Users}
          iconClassName="bg-[#D4AF37]/15 text-[#A87B1B]"
        />

        <LiveMetricCard
          label="Platform uptime"
          value={`${summary.averageUptime.toFixed(2)}%`}
          detail="Rolling service average"
          change={0.01}
          icon={Cloud}
          iconClassName="bg-violet-50 text-violet-700"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <LiveChartCard
          title="Response latency"
          description="Live average response time across monitored services."
          value={`${latencyHistory.at(-1) ?? 0} ms`}
          data={latencyHistory}
          icon={Activity}
          suffix="ms"
        />

        <LiveChartCard
          title="Active platform traffic"
          description="Current users across all connected client systems."
          value={`${trafficHistory.at(-1) ?? 0} users`}
          data={trafficHistory}
          icon={Users}
          suffix=""
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-[#0B1020]/[0.07] bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#0B1020]/[0.06] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-[#A87B1B]" />

              <h2 className="text-base font-bold text-[#0B1020]">
                Infrastructure health
              </h2>
            </div>

            <p className="mt-1 text-sm text-[#5A6173]">
              Live connectivity and performance across core providers.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#0B1020]/[0.04] px-3 py-1.5 text-xs font-bold text-[#475569]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#14B8A6]" />
            Updating every 2.8 seconds
          </span>
        </div>

        <div className="divide-y divide-[#0B1020]/[0.06]">
          {services.map((service) => (
            <ServiceRow key={service.id} service={service} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <article className="overflow-hidden rounded-3xl border border-[#0B1020]/[0.07] bg-white">
          <div className="border-b border-[#0B1020]/[0.06] px-5 py-5 sm:px-6">
            <div className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-[#A87B1B]" />

              <h2 className="text-base font-bold text-[#0B1020]">
                Client platforms
              </h2>
            </div>

            <p className="mt-1 text-sm text-[#5A6173]">
              Real-time activity and availability for hosted client systems.
            </p>
          </div>

          <div className="divide-y divide-[#0B1020]/[0.06]">
            {platforms.map((platform) => (
              <ClientPlatformRow key={platform.id} platform={platform} />
            ))}
          </div>
        </article>

        <article className="overflow-hidden rounded-3xl border border-[#0B1020]/[0.07] bg-white">
          <div className="border-b border-[#0B1020]/[0.06] px-5 py-5">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#A87B1B]" />

              <h2 className="text-base font-bold text-[#0B1020]">
                Live activity
              </h2>
            </div>

            <p className="mt-1 text-sm text-[#5A6173]">
              Latest operational events from Syntra Grid.
            </p>
          </div>

          <div className="divide-y divide-[#0B1020]/[0.06]">
            {events.map((event) => (
              <ActivityItem
                key={event.id}
                event={event}
                currentTime={clock}
              />
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function LiveMetricCard({
  label,
  value,
  detail,
  change,
  icon: Icon,
  iconClassName,
  invertChange = false,
}: {
  label: string;
  value: string;
  detail: string;
  change: number;
  icon: LucideIcon;
  iconClassName: string;
  invertChange?: boolean;
}) {
  const mathematicallyPositive = change >= 0;
  const favourable = invertChange
    ? !mathematicallyPositive
    : mathematicallyPositive;

  const ChangeIcon = mathematicallyPositive
    ? ArrowUpRight
    : ArrowDownRight;

  return (
    <article className="relative overflow-hidden rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
      <div className="absolute right-5 top-5 flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#14B8A6] opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#14B8A6]" />
        </span>

        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">
          Live
        </span>
      </div>

      <div
        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClassName}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-5 text-sm font-semibold text-[#64748B]">{label}</p>

      <p
        key={value}
        className="mt-1 animate-[pulse_500ms_ease-out] text-3xl font-bold tracking-tight text-[#0B1020]"
      >
        {value}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 text-xs font-bold ${
            favourable ? 'text-[#0D9488]' : 'text-amber-700'
          }`}
        >
          <ChangeIcon className="h-3.5 w-3.5" />
          {Math.abs(change).toFixed(2)}%
        </span>

        <span className="text-xs text-[#94A3B8]">{detail}</span>
      </div>
    </article>
  );
}

function LiveChartCard({
  title,
  description,
  value,
  data,
  icon: Icon,
  suffix,
}: {
  title: string;
  description: string;
  value: string;
  data: number[];
  icon: LucideIcon;
  suffix: string;
}) {
  const maximum = Math.max(...data);
  const minimum = Math.min(...data);
  const range = Math.max(maximum - minimum, 1);

  const points = data
    .map((item, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const y = 82 - ((item - minimum) / range) * 64;

      return `${x},${y}`;
    })
    .join(' ');

  const latest = data.at(-1) ?? 0;
  const previous = data.at(-2) ?? latest;
  const improving = latest <= previous;

  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-[#A87B1B]" />

            <h2 className="text-base font-bold text-[#0B1020]">{title}</h2>
          </div>

          <p className="mt-1 text-sm text-[#5A6173]">{description}</p>
        </div>

        <div className="text-right">
          <p
            key={value}
            className="animate-[pulse_500ms_ease-out] text-xl font-bold text-[#0B1020]"
          >
            {value}
          </p>

          <p
            className={`mt-1 text-xs font-bold ${
              improving ? 'text-[#0D9488]' : 'text-amber-700'
            }`}
          >
            {latest === previous
              ? 'Stable'
              : `${Math.abs(latest - previous)}${suffix} ${
                  improving ? 'lower' : 'higher'
                }`}
          </p>
        </div>
      </div>

      <div className="relative mt-6 h-40 overflow-hidden rounded-2xl bg-[#F8FAFC]">
        <div className="absolute inset-0 flex flex-col justify-between py-4">
          {[0, 1, 2, 3].map((line) => (
            <div
              key={line}
              className="border-t border-dashed border-[#0B1020]/[0.06]"
            />
          ))}
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label={`${title} live trend`}
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient
              id={`gradient-${title.replace(/\s/g, '-')}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
            </linearGradient>
          </defs>

          <polygon
            points={`0,100 ${points} 100,100`}
            fill={`url(#gradient-${title.replace(/\s/g, '-')})`}
          />

          <polyline
            points={points}
            fill="none"
            stroke="#0D9488"
            strokeWidth="2.2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-700"
          />

          <circle
            cx="100"
            cy={82 - ((latest - minimum) / range) * 64}
            r="2.6"
            fill="#0D9488"
            className="animate-pulse"
          />
        </svg>

        <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[10px] font-semibold text-[#94A3B8]">
          <span>45 seconds ago</span>
          <span>Live</span>
        </div>
      </div>
    </article>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const Icon = service.icon;
  const latencyDifference =
    service.latency - service.previousLatency;

  return (
    <div className="flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-[#FAFAF9] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B1020]/[0.05] text-[#334155]">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-[#0B1020]">
              {service.name}
            </h3>

            <StatusBadge status={service.status} />
          </div>

          <p className="mt-1 text-xs text-[#64748B]">
            {service.provider} · {service.uptime.toFixed(2)}% uptime
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:flex sm:items-center sm:gap-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
            Response
          </p>

          <p
            key={service.latency}
            className="mt-1 animate-[pulse_450ms_ease-out] text-sm font-bold text-[#334155]"
          >
            {service.latency} ms
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
            Change
          </p>

          <p
            className={`mt-1 inline-flex items-center gap-1 text-sm font-bold ${
              latencyDifference <= 0
                ? 'text-[#0D9488]'
                : 'text-amber-700'
            }`}
          >
            {latencyDifference <= 0 ? (
              <ArrowDownRight className="h-4 w-4" />
            ) : (
              <ArrowUpRight className="h-4 w-4" />
            )}

            {Math.abs(latencyDifference)} ms
          </p>
        </div>

        <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-[#E8ECEA] sm:block">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              service.status === 'HEALTHY'
                ? 'bg-[#14B8A6]'
                : service.status === 'DEGRADED'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{
              width: `${clamp(
                100 - service.latency / 3,
                12,
                100,
              )}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ClientPlatformRow({
  platform,
}: {
  platform: ClientPlatform;
}) {
  const responseDifference =
    platform.responseTime - platform.previousResponseTime;
  const userDifference =
    platform.activeUsers - platform.previousActiveUsers;

  return (
    <div className="px-5 py-5 transition hover:bg-[#FAFAF9] sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0B1020]/[0.05] text-xs font-bold text-[#0B1020]">
            {getInitials(platform.name)}

            <span
              className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white ${
                platform.status === 'HEALTHY'
                  ? 'bg-[#14B8A6]'
                  : 'bg-amber-500'
              }`}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-[#0B1020]">
                {platform.name}
              </h3>

              <StatusBadge status={platform.status} />
            </div>

            <p className="mt-1 text-xs text-[#64748B]">
              {platform.product} · deployed {platform.lastDeployment}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          <PlatformMetric
            label="Active users"
            value={platform.activeUsers.toLocaleString('en-GB')}
            difference={userDifference}
            positiveIsGood
          />

          <PlatformMetric
            label="Response"
            value={`${platform.responseTime} ms`}
            difference={responseDifference}
            suffix=" ms"
          />

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
              Uptime
            </p>

            <p className="mt-1 text-sm font-bold text-[#334155]">
              {platform.uptime.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformMetric({
  label,
  value,
  difference,
  suffix = '',
  positiveIsGood = false,
}: {
  label: string;
  value: string;
  difference: number;
  suffix?: string;
  positiveIsGood?: boolean;
}) {
  const favourable = positiveIsGood
    ? difference >= 0
    : difference <= 0;

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
        {label}
      </p>

      <p
        key={value}
        className="mt-1 animate-[pulse_450ms_ease-out] text-sm font-bold text-[#334155]"
      >
        {value}
      </p>

      <p
        className={`mt-0.5 text-[10px] font-bold ${
          favourable ? 'text-[#0D9488]' : 'text-amber-700'
        }`}
      >
        {difference > 0 ? '+' : ''}
        {difference}
        {suffix}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const configuration: Record<
    HealthStatus,
    {
      label: string;
      classes: string;
      dot: string;
      icon: LucideIcon;
    }
  > = {
    HEALTHY: {
      label: 'Operational',
      classes: 'bg-emerald-50 text-emerald-700',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
    },
    DEGRADED: {
      label: 'Degraded',
      classes: 'bg-amber-50 text-amber-700',
      dot: 'bg-amber-500',
      icon: AlertTriangle,
    },
    OFFLINE: {
      label: 'Offline',
      classes: 'bg-red-50 text-red-700',
      dot: 'bg-red-500',
      icon: XCircle,
    },
  };

  const config = configuration[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${config.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function ActivityItem({
  event,
  currentTime,
}: {
  event: ActivityEvent;
  currentTime: Date;
}) {
  const Icon =
    event.type === 'SUCCESS'
      ? CheckCircle2
      : event.type === 'WARNING'
        ? AlertTriangle
        : Activity;

  const iconClasses =
    event.type === 'SUCCESS'
      ? 'bg-emerald-50 text-emerald-700'
      : event.type === 'WARNING'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-blue-50 text-blue-700';

  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClasses}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#334155]">{event.title}</p>

        <p className="mt-1 text-xs leading-5 text-[#64748B]">
          {event.description}
        </p>

        <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#94A3B8]">
          <Clock3 className="h-3 w-3" />
          {formatRelativeTime(event.createdAt, currentTime)}
        </p>
      </div>
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatRelativeTime(date: Date, currentTime: Date) {
  const seconds = Math.max(
    0,
    Math.floor((currentTime.getTime() - date.getTime()) / 1000),
  );

  if (seconds < 5) {
    return 'Just now';
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}