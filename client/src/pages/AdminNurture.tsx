import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Play,
  RefreshCw,
  Settings,
  SkipForward,
  Trash2,
  Zap,
} from "lucide-react";

const STAGE_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
    icon: <Clock className="w-3 h-3" />,
  },
  sent: {
    label: "Sent",
    variant: "default",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed: {
    label: "Failed",
    variant: "destructive",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  skipped: {
    label: "Skipped",
    variant: "outline",
    icon: <SkipForward className="w-3 h-3" />,
  },
};

export default function AdminNurture() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect non-admins
  if (!loading && (!user || user.role !== "admin")) {
    navigate("/");
    return null;
  }

  const utils = trpc.useUtils();

  const { data: statusData, isLoading: statusLoading } = trpc.nurture.status.useQuery();
  const { data: cronData, isLoading: cronLoading } = trpc.nurture.cronStatus.useQuery();
  const { data: dueData } = trpc.nurture.dueCount.useQuery();

  const setupCronMutation = trpc.nurture.setupCron.useMutation({
    onSuccess: (data) => {
      toast.success(`Cron job created! Next run: ${data.nextExecutionAt ?? "soon"}`);
      utils.nurture.cronStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteCronMutation = trpc.nurture.deleteCron.useMutation({
    onSuccess: () => {
      toast.success("Cron job deleted");
      utils.nurture.cronStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const triggerMutation = trpc.nurture.triggerForLead.useMutation({
    onSuccess: () => {
      toast.success("Follow-up sent successfully");
      utils.nurture.status.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const stats = statusData?.stats;
  const leads = statusData?.leads ?? [];
  const cronJob = cronData?.job;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="w-6 h-6 text-primary" />
              Lead Nurture Automation
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              24-hour follow-up emails sent automatically via HubSpot
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              utils.nurture.status.invalidate();
              utils.nurture.cronStatus.invalidate();
              utils.nurture.dueCount.invalidate();
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Leads", value: stats?.total ?? 0, color: "text-foreground" },
            { label: "Pending", value: stats?.pending ?? 0, color: "text-yellow-500" },
            { label: "Sent", value: stats?.sent ?? 0, color: "text-green-500" },
            { label: "Failed", value: stats?.failed ?? 0, color: "text-red-500" },
            { label: "Due Now", value: dueData?.count ?? 0, color: "text-blue-500" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-3">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cron Job Setup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Heartbeat Cron Job
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cronLoading ? (
              <div className="text-sm text-muted-foreground">Checking cron status...</div>
            ) : cronJob ? (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={cronJob.isEnabled ? "default" : "secondary"}>
                      {cronJob.isEnabled ? "Active" : "Paused"}
                    </Badge>
                    <span className="text-sm font-medium">{cronJob.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {cronJob.cronExpression}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last run:{" "}
                    {cronJob.lastExecutedAt
                      ? new Date(cronJob.lastExecutedAt).toLocaleString()
                      : "Never"}{" "}
                    · Next:{" "}
                    {cronJob.nextExecutionAt
                      ? new Date(cronJob.nextExecutionAt).toLocaleString()
                      : "Unknown"}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteCronMutation.mutate({ taskUid: cronJob.taskUid })}
                  disabled={deleteCronMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    No cron job configured. Set up the hourly job to process leads automatically.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Runs every hour · Processes up to 50 leads per run · Requires site to be deployed
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setupCronMutation.mutate()}
                  disabled={setupCronMutation.isPending}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {setupCronMutation.isPending ? "Setting up..." : "Setup Cron Job"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Lead Nurture Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {statusLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Loading leads...
              </div>
            ) : leads.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No leads yet. Submit an inquiry from the contact form to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Apartment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scheduled For</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => {
                      const stage = lead.nurtureStage ?? "pending";
                      const config = STAGE_CONFIG[stage] ?? STAGE_CONFIG.pending;
                      const isPending = stage === "pending" || stage === "failed";

                      return (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{lead.name}</div>
                            <div className="text-xs text-muted-foreground">{lead.email}</div>
                          </TableCell>
                          <TableCell className="text-sm">{lead.apartmentName}</TableCell>
                          <TableCell>
                            <Badge
                              variant={config.variant}
                              className="flex items-center gap-1 w-fit text-xs"
                            >
                              {config.icon}
                              {config.label}
                            </Badge>
                            {lead.nurtureError && (
                              <div className="text-xs text-destructive mt-1 max-w-[180px] truncate">
                                {lead.nurtureError}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {lead.nurtureScheduledFor
                              ? new Date(lead.nurtureScheduledFor).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {lead.nurtureSentAt
                              ? new Date(lead.nurtureSentAt).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {isPending && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  triggerMutation.mutate({ inquiryId: lead.id! })
                                }
                                disabled={triggerMutation.isPending}
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Send Now
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HubSpot Setup Instructions */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              HubSpot Workflow Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              When a follow-up is sent, the HubSpot contact is updated with{" "}
              <code className="bg-muted px-1 rounded">followup_sent = true</code> and lifecycle
              stage advanced to <code className="bg-muted px-1 rounded">marketingqualifiedlead</code>.
            </p>
            <p>
              To send the actual email, create a HubSpot Workflow:{" "}
              <strong>Contacts → Workflows → Create → Contact-based</strong>. Set the trigger to
              "Contact property — followup_sent is known" and add a "Send email" action using your
              follow-up template.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
