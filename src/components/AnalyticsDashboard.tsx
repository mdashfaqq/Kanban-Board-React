import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, BarChart3 } from 'lucide-react'

interface AnalyticsDashboardProps {
  metrics: {
    wip: number
    cycleTime: number
    throughput: number
    blockedCards: number
    staleCards: number
    flowEfficiency: number
    wipViolations: number
  }
}

export default function AnalyticsDashboard({ metrics }: AnalyticsDashboardProps) {
  const getHealthStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return { status: 'healthy', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/20' }
    if (value <= thresholds.warning) return { status: 'warning', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/20' }
    return { status: 'critical', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/20' }
  }

  const wipHealth = getHealthStatus(metrics.wip, { good: 10, warning: 20 })
  const cycleTimeHealth = getHealthStatus(metrics.cycleTime, { good: 3, warning: 7 })
  const throughputHealth = getHealthStatus(metrics.throughput, { good: 5, warning: 2 })
  const blockedHealth = getHealthStatus(metrics.blockedCards, { good: 0, warning: 2 })
  const staleHealth = getHealthStatus(metrics.staleCards, { good: 0, warning: 3 })

  return (
    <div className="space-y-6">
      {/* Overall Flow Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Flow Health
          </CardTitle>
          <CardDescription>Overall workflow health score based on multiple metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-primary">
              {Math.round(metrics.flowEfficiency)}
            </div>
            <div className="flex-1 space-y-2">
              <HealthBadge label="WIP" status={wipHealth.status} />
              <HealthBadge label="Cycle Time" status={cycleTimeHealth.status} />
              <HealthBadge label="Blocked Work" status={blockedHealth.status} />
              <HealthBadge label="Stale Cards" status={staleHealth.status} />
              <HealthBadge label="Throughput" status={throughputHealth.status} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          title="Work in Progress"
          value={metrics.wip}
          icon={<Clock className="h-5 w-5" />}
          health={wipHealth}
          description="Active cards across all columns"
        />
        <MetricCard
          title="Average Cycle Time"
          value={`${metrics.cycleTime} days`}
          icon={<TrendingUp className="h-5 w-5" />}
          health={cycleTimeHealth}
          description="Time from start to completion"
        />
        <MetricCard
          title="Throughput"
          value={`${metrics.throughput}/week`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          health={throughputHealth}
          description="Cards completed per week"
        />
        <MetricCard
          title="Blocked Cards"
          value={metrics.blockedCards}
          icon={<AlertTriangle className="h-5 w-5" />}
          health={blockedHealth}
          description="Cards currently blocked"
        />
        <MetricCard
          title="Stale Cards"
          value={metrics.staleCards}
          icon={<Clock className="h-5 w-5" />}
          health={staleHealth}
          description="Cards older than normal cycle time"
        />
        <MetricCard
          title="WIP Violations"
          value={metrics.wipViolations}
          icon={<AlertTriangle className="h-5 w-5" />}
          health={getHealthStatus(metrics.wipViolations, { good: 0, warning: 1 })}
          description="Columns exceeding WIP limits"
        />
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>AI-generated suggestions to improve flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {wipHealth.status === 'critical' && (
              <Recommendation
                severity="high"
                text="WIP is significantly elevated. Consider finishing existing work before starting new tasks."
              />
            )}
            {cycleTimeHealth.status === 'critical' && (
              <Recommendation
                severity="high"
                text="Cycle time is unusually high. Investigate blockers and process bottlenecks."
              />
            )}
            {blockedHealth.status !== 'healthy' && (
              <Recommendation
                severity="medium"
                text={`There are ${metrics.blockedCards} blocked cards. Review and resolve blockers to improve flow.`}
              />
            )}
            {staleHealth.status !== 'healthy' && (
              <Recommendation
                severity="medium"
                text={`${metrics.staleCards} cards are stale. Review aging work and either complete or re-estimate.`}
              />
            )}
            {metrics.wipViolations > 0 && (
              <Recommendation
                severity="medium"
                text={`${metrics.wipViolations} columns are exceeding WIP limits. Respect WIP limits to improve flow.`}
              />
            )}
            {wipHealth.status === 'healthy' && cycleTimeHealth.status === 'healthy' && blockedHealth.status === 'healthy' && (
              <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Your workflow is healthy! Keep up the good work.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon,
  health,
  description,
}: {
  title: string
  value: string | number
  icon: React.ReactNode
  health: { status: string; color: string; bg: string }
  description: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={health.color}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${health.color}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        <div className={`mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${health.bg} ${health.color}`}>
          {health.status}
        </div>
      </CardContent>
    </Card>
  )
}

function HealthBadge({ label, status }: { label: string; status: string }) {
  const colors = {
    healthy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors]}`}>
        {status}
      </span>
    </div>
  )
}

function Recommendation({ severity, text }: { severity: 'high' | 'medium' | 'low'; text: string }) {
  const colors = {
    high: 'border-red-200 bg-red-50 dark:bg-red-900/10',
    medium: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10',
    low: 'border-blue-200 bg-blue-50 dark:bg-blue-900/10',
  }

  const icons = {
    high: <AlertTriangle className="h-4 w-4 text-red-600" />,
    medium: <Clock className="h-4 w-4 text-yellow-600" />,
    low: <CheckCircle2 className="h-4 w-4 text-blue-600" />,
  }

  return (
    <div className={`p-3 rounded-lg border ${colors[severity]}`}>
      <div className="flex items-start gap-2">
        {icons[severity]}
        <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
      </div>
    </div>
  )
}
