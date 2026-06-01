import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RefreshCw,
  Database,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Trash2,
  Building2,
  BarChart3,
  CalendarClock,
} from "lucide-react";
import AdminNav from "@/components/AdminNav";

export default function AdminRentcast() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!loading && !user) {
      toast.error("Please log in to access the admin panel.");
      navigate("/");
    } else if (!loading && user && user.role !== "admin") {
      toast.error("You do not have permission to access this page.");
      navigate("/");
    }
  }, [user, loading, navigate]);

  const {
    data: cronData,
    isLoading: cronLoading,
    refetch: refetchCron,
  } = trpc.rentcast.cronStatus.useQuery(undefined, {
    enabled: !loading && !!user && user.role === "admin",
    refetchOnWindowFocus: false,
  });

  const {
    data: cacheData,
    isLoading: cacheLoading,
    refetch: refetchCache,
  } = trpc.rentcast.cacheStats.useQuery(undefined, {
    enabled: !loading && !!user && user.role === "admin",
    refetchOnWindowFocus: false,
  });

  const setupCronMutation = trpc.rentcast.setupCron.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.rentcast.cronStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCronMutation = trpc.rentcast.deleteCron.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      utils.rentcast.cronStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSetupCron() {
    setupCronMutation.mutate({ cron: "0 0 3 * * *" }); // daily 03:00 UTC
  }

  function handleDeleteCron() {
    if (!cronData?.job?.taskUid) return;
    deleteCronMutation.mutate({ taskUid: cronData.job.taskUid });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const job = cronData?.job;
  const lastRefresh = cronData?.lastRefresh;
  const stats = cacheData?.stats;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav active="rentcast" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Database className="w-6 h-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">RentCast Refresh</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Manage the nightly Heartbeat cron that refreshes RentCast rental listings and persists
            them to the database.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cron status card */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                    <CalendarClock className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Nightly Cron</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Heartbeat job — runs daily at 03:00 UTC
                    </CardDescription>
                  </div>
                </div>
                {cronLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-300" />
                ) : job ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-slate-400">
                    Not configured
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {job ? (
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Schedule</span>
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                      {job.cronExpression}
                    </span>
                  </div>
                  {job.lastExecutedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last run</span>
                      <span>{new Date(job.lastExecutedAt).toLocaleString()}</span>
                    </div>
                  )}
                  {job.nextExecutionAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Next run</span>
                      <span>{new Date(job.nextExecutionAt).toLocaleString()}</span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleDeleteCron}
                    disabled={deleteCronMutation.isPending}
                  >
                    {deleteCronMutation.isPending ? (
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Delete Cron Job
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    No cron job is active. The site must be{" "}
                    <strong>deployed</strong> before creating the cron — the platform
                    POSTs to your production URL on each trigger.
                  </p>
                  <Button
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={handleSetupCron}
                    disabled={setupCronMutation.isPending}
                  >
                    {setupCronMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Create Nightly Cron
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last refresh stats card */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Last Refresh</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Stats from the most recent cron run
                    </CardDescription>
                  </div>
                </div>
                <button
                  onClick={() => { refetchCron(); refetchCache(); }}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {lastRefresh ? (
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Time</span>
                    <span>
                      {lastRefresh.at
                        ? new Date(lastRefresh.at).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Status</span>
                    {lastRefresh.status === "ready" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
                      </Badge>
                    ) : lastRefresh.status === "error" ? (
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" /> Error
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {lastRefresh.status ?? "—"}
                      </Badge>
                    )}
                  </div>
                  {lastRefresh.stats && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Properties</span>
                        <span>{(lastRefresh.stats.totalProperties as number)?.toLocaleString() ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">RentCast matches</span>
                        <span>{(lastRefresh.stats.rentcastMatches as number)?.toLocaleString() ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">API requests used</span>
                        <span>
                          {lastRefresh.stats.requestsUsed as number} /{" "}
                          {((lastRefresh.stats.requestsUsed as number) +
                            (lastRefresh.stats.requestsRemaining as number)) || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Duration</span>
                        <span>{lastRefresh.stats.duration as string ?? "—"}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  No refresh has run yet. Stats will appear here after the first cron execution.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live cache stats */}
        <Card className="border border-slate-200 shadow-sm mt-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Current Cache Stats</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Live view of the in-memory RentCast cache
                  </CardDescription>
                </div>
              </div>
              {cacheLoading && <RefreshCw className="w-4 h-4 animate-spin text-slate-300" />}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total properties", value: stats.totalProperties?.toLocaleString() },
                  { label: "RentCast matches", value: stats.rentcastMatches?.toLocaleString() },
                  { label: "With pricing", value: stats.withPricing?.toLocaleString() },
                  { label: "With photos", value: stats.withPhotos?.toLocaleString() },
                  { label: "Neighborhoods", value: stats.cities?.toLocaleString() },
                  { label: "Requests used", value: stats.monthlyRequestsUsed?.toLocaleString() },
                  { label: "Requests left", value: stats.monthlyRequestsRemaining?.toLocaleString() },
                  {
                    label: "Last updated",
                    value: stats.lastUpdated
                      ? new Date(stats.lastUpdated).toLocaleDateString()
                      : "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                    <p className="text-lg font-semibold text-slate-800">{value ?? "—"}</p>
                  </div>
                ))}
              </div>
            ) : cacheLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading stats…
              </div>
            ) : (
              <p className="text-xs text-slate-400">Stats unavailable.</p>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-slate-400 mt-6 text-center">
          The cron runs at 03:00 UTC daily (10:00 PM CT). Manage execution history and pause/resume
          from the Manus dashboard under Settings → Schedules.
        </p>
      </div>
    </div>
  );
}
