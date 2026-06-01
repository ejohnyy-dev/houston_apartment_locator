import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Download,
  Users,
  Building2,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import AdminNav from "@/components/AdminNav";

export default function AdminReports() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [downloadingInventory, setDownloadingInventory] = useState(false);
  const [downloadingLeads, setDownloadingLeads] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      toast.error("Please log in to access the admin panel.");
      navigate("/");
    } else if (!loading && user && user.role !== "admin") {
      toast.error("You do not have permission to access this page.");
      navigate("/");
    }
  }, [user, loading, navigate]);

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } =
    trpc.reports.status.useQuery(undefined, {
      enabled: !loading && !!user && user.role === "admin",
      refetchOnWindowFocus: false,
    });

  // Fetch apartment inventory report on demand
  const inventoryQuery = trpc.reports.apartmentInventory.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  // Fetch leads report on demand
  const leadsQuery = trpc.reports.leadsReport.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  function downloadBase64(base64: string, filename: string) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadInventory() {
    setDownloadingInventory(true);
    try {
      const result = await inventoryQuery.refetch();
      if (result.data?.data) {
        downloadBase64(result.data.data, result.data.filename);
        toast.success(`Downloaded ${result.data.filename}`);
      } else {
        toast.error("Failed to generate report — no data returned.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate inventory report.");
    } finally {
      setDownloadingInventory(false);
    }
  }

  async function handleDownloadLeads() {
    setDownloadingLeads(true);
    try {
      const result = await leadsQuery.refetch();
      if (result.data?.data) {
        downloadBase64(result.data.data, result.data.filename);
        toast.success(`Downloaded ${result.data.filename}`);
      } else {
        toast.error("Failed to generate report — no data returned.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate leads report.");
    } finally {
      setDownloadingLeads(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav active="reports" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 className="w-6 h-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Download Excel reports for apartment inventory and lead analytics.
          </p>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 mb-6">
          {statusLoading ? (
            <span className="text-sm text-slate-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading status…
            </span>
          ) : status ? (
            <>
              <Badge variant="outline" className="text-xs gap-1.5">
                <Building2 className="w-3 h-3" />
                {status.apartmentInventory.count.toLocaleString()} apartments
              </Badge>
              <Badge variant="outline" className="text-xs gap-1.5">
                <Users className="w-3 h-3" />
                {status.leadsReport.count.toLocaleString()} leads
              </Badge>
              <button
                onClick={() => refetchStatus()}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </>
          ) : null}
        </div>

        {/* Report cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Apartment Inventory */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Apartment Inventory</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      All properties with pricing &amp; neighborhood stats
                    </CardDescription>
                  </div>
                </div>
                <FileSpreadsheet className="w-4 h-4 text-slate-300 mt-1" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="text-xs text-slate-500 space-y-1 mb-4">
                <li>• Overview: key metrics (total, avg rent, neighborhoods)</li>
                <li>• Inventory: full property list with rent &amp; bedroom data</li>
                <li>• Summary: properties grouped by neighborhood</li>
              </ul>
              {status && !status.apartmentInventory.available && (
                <p className="text-xs text-amber-600 mb-3">
                  No apartment data available to generate this report.
                </p>
              )}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleDownloadInventory}
                disabled={downloadingInventory || (status != null && !status.apartmentInventory.available)}
              >
                {downloadingInventory ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" /> Download Excel
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Leads Report */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Leads Report</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      All inquiries with contact info &amp; source analytics
                    </CardDescription>
                  </div>
                </div>
                <FileSpreadsheet className="w-4 h-4 text-slate-300 mt-1" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="text-xs text-slate-500 space-y-1 mb-4">
                <li>• Overview: totals by day / week / month</li>
                <li>• Leads: full contact list sorted by date</li>
                <li>• Summary: top apartments &amp; traffic sources</li>
              </ul>
              {status && !status.leadsReport.available && (
                <p className="text-xs text-amber-600 mb-3">
                  No leads found. Reports will be available once inquiries come in.
                </p>
              )}
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleDownloadLeads}
                disabled={downloadingLeads || (status != null && !status.leadsReport.available)}
              >
                {downloadingLeads ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" /> Download Excel
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info note */}
        <p className="text-xs text-slate-400 mt-6 text-center">
          Reports are generated on demand and reflect the current database state.
          Files are in .xlsx format compatible with Excel, Google Sheets, and Numbers.
        </p>
      </div>
    </div>
  );
}
