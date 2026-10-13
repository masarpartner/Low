import { useGetDashboardStats } from '@workspace/api-client-react';
import { Briefcase, Calendar, CheckCircle2, Clock, ArrowLeft, Sparkles, FileKey, Gavel, XCircle, CheckSquare, Timer, AlertTriangle, ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';

const stats = [
  {
    key: 'totalCases',
    label: 'إجمالي القضايا',
    icon: Briefcase,
    gradient: 'from-emerald-600/15 to-emerald-700/5',
    iconBg: 'bg-emerald-600/15',
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    borderColor: 'border-emerald-600/20',
    dotColor: 'bg-emerald-600',
    href: '/sessions',
  },
  {
    key: 'todayHearings',
    label: 'جلسات اليوم',
    icon: Calendar,
    gradient: 'from-amber-500/15 to-amber-600/5',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-500',
    borderColor: 'border-amber-500/20',
    dotColor: 'bg-amber-500',
    href: '/sessions',
  },
  {
    key: 'upcomingHearings',
    label: 'جلسات قادمة',
    icon: Clock,
    gradient: 'from-emerald-500/15 to-emerald-600/5',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
    borderColor: 'border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    href: '/sessions',
  },
  {
    key: 'finishedHearings',
    label: 'جلسات منتهية',
    icon: CheckCircle2,
    gradient: 'from-purple-500/15 to-purple-600/5',
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-500',
    borderColor: 'border-purple-500/20',
    dotColor: 'bg-purple-500',
    href: '/sessions',
  },
  {
    key: 'totalPoas',
    label: 'إجمالي الوكالات',
    icon: FileKey,
    gradient: 'from-blue-500/15 to-blue-600/5',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-500',
    borderColor: 'border-blue-500/20',
    dotColor: 'bg-blue-500',
    href: '/poa',
  },
  {
    key: 'favorableJudgments',
    label: 'أحكام نهائية',
    icon: Gavel,
    gradient: 'from-emerald-600/15 to-emerald-700/5',
    iconBg: 'bg-emerald-600/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-600/30',
    dotColor: 'bg-emerald-600',
    href: '/judgments',
  },
  {
    key: 'unfavorableJudgments',
    label: 'أحكام ابتدائية',
    icon: XCircle,
    gradient: 'from-blue-600/15 to-blue-700/5',
    iconBg: 'bg-blue-600/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-600/30',
    dotColor: 'bg-blue-600',
    href: '/judgments',
  },
] as const;

const taskStats = [
  {
    key: 'totalTasks',
    label: 'إجمالي المهام',
    icon: ListChecks,
    gradient: 'from-amber-500/15 to-amber-600/5',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-500',
    borderColor: 'border-amber-500/20',
    dotColor: 'bg-amber-500',
  },
  {
    key: 'inProgressTasks',
    label: 'قيد التنفيذ',
    icon: Timer,
    gradient: 'from-blue-500/15 to-blue-600/5',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-500',
    borderColor: 'border-blue-500/20',
    dotColor: 'bg-blue-500',
  },
  {
    key: 'completedTasks',
    label: 'مهام مكتملة',
    icon: CheckSquare,
    gradient: 'from-emerald-500/15 to-emerald-600/5',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
    borderColor: 'border-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
  {
    key: 'urgentTasks',
    label: 'مهام عاجلة',
    icon: AlertTriangle,
    gradient: 'from-red-500/15 to-red-600/5',
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-500',
    borderColor: 'border-red-500/20',
    dotColor: 'bg-red-500',
  },
] as const;

export default function DashboardPage() {
  const { data, isLoading, error } = useGetDashboardStats();

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-5 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">فشل تحميل إحصائيات لوحة التحكم</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="fade-in-up flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              مرحباً بك، سيادة المحامي ⚖️
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mr-4">
            المكتب الرقمي الموحد لإدارة جلسات المحاكم، الوكالات، الأحكام القضائية، والمهام اليومية
          </p>
        </div>
        <div className="flex items-center gap-2 mr-4 md:mr-0">
          <Link href="/chat">
            <div
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-md cursor-pointer transition-all duration-200 hover:shadow-lg hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #B88A3B 0%, #8E6825 100%)' }}
            >
              <Sparkles className="w-4 h-4" />
              <span>تحليل رسالة جلسة جديدة</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const value = (data as Record<string, number> | undefined)?.[stat.key];

          return (
            <Link key={stat.key} href={stat.href}>
              <div
                className={`fade-in-up fade-in-up-delay-${i + 1} rounded-2xl border border-slate-200/80 dark:border-border bg-white dark:bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-emerald-600/40 hover:-translate-y-0.5 cursor-pointer h-full flex flex-col justify-between shadow-xs`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl ${stat.iconBg} flex items-center justify-center shadow-xs`}>
                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                  <div className={`w-2 h-2 rounded-full ${stat.dotColor} mt-1`} />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16 mb-1" />
                  ) : (
                    <div className="text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-foreground" data-testid={`stat-${stat.key}`}>
                      {value ?? 0}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1.5 font-semibold">{stat.label}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Tasks Stats Section */}
      <div className="fade-in-up">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#B88A3B,#D4A855)' }}>
            <CheckSquare className="w-3 h-3 text-white" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">إحصائيات المهام</h2>
          <Link href="/tasks" className="mr-auto text-xs text-primary hover:underline flex items-center gap-0.5">
            عرض الكل <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {taskStats.map((stat, i) => {
            const Icon = stat.icon;
            const value = (data as Record<string, number> | undefined)?.[stat.key];
            return (
              <Link key={stat.key} href="/tasks">
                <div
                  className={`fade-in-up fade-in-up-delay-${i + 1} rounded-2xl border border-slate-200/80 dark:border-border bg-white dark:bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-amber-500/40 hover:-translate-y-0.5 cursor-pointer h-full flex flex-col justify-between shadow-xs`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center shadow-xs`}>
                      <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                    </div>
                    <div className={`w-2 h-2 rounded-full ${stat.dotColor} mt-1`} />
                  </div>
                  <div>
                    {isLoading ? (
                      <Skeleton className="h-8 w-12 mb-1" />
                    ) : (
                      <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-foreground">{value ?? 0}</div>
                    )}
                    <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1 font-medium">{stat.label}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="fade-in-up fade-in-up-delay-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Link href="/chat">
          <div
            className="group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 to-primary/3 p-6 cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 h-full"
            data-testid="link-analyze-message"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base mb-1">تحليل رسالة جديدة</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  استخراج تفاصيل الجلسة من الرسالة النصية
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowLeft className="w-4 h-4 text-primary" />
            </div>
          </div>
        </Link>

        <Link href="/sessions">
          <div
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 h-full"
            data-testid="link-view-sessions"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Calendar className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base mb-1">عرض جميع الجلسات</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  تصفّح وإدارة جلسات الاستماع
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </Link>

        <Link href="/poa">
          <div
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 cursor-pointer transition-all duration-200 hover:border-blue-500/30 hover:shadow-lg hover:-translate-y-0.5 h-full"
            data-testid="link-view-poa"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <FileKey className="w-6 h-6 text-blue-500 transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base mb-1">إدارة الوكالات الشرعية</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  متابعة الوكالات وتواريخ الانتهاء
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </Link>

        <Link href="/judgments">
          <div
            className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 cursor-pointer transition-all duration-200 hover:border-emerald-500/30 hover:shadow-lg hover:-translate-y-0.5 h-full"
            data-testid="link-view-judgments"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                <Gavel className="w-6 h-6 text-emerald-500 transition-colors" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base mb-1">سجل الأحكام القضائية</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  متابعة القرارات والأحكام النهائية
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

