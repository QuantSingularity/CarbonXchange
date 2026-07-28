import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, FileText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, EmptyState, ErrorState } from "@/components/StatusPieces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import {
  complianceApi,
  apiErrorMessage,
  type ComplianceStatusSummary,
  type ComplianceRecord,
  type RegulatoryReport,
} from "@/services/api";
import { formatDate, humanize } from "@/lib/format";

const staffRoles = new Set(["admin", "compliance_officer", "auditor"]);

export function Compliance() {
  const { user } = useAuth();
  const isStaff = user ? staffRoles.has(user.role) : false;

  const [status, setStatus] = useState<ComplianceStatusSummary | null>(null);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [reports, setReports] = useState<RegulatoryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, recordsRes] = await Promise.all([
        complianceApi.myStatus(),
        complianceApi.records({ per_page: 20 }),
      ]);
      setStatus(statusRes);
      setRecords(recordsRes.records);

      if (isStaff) {
        const reportsRes = await complianceApi.reports({ per_page: 20 });
        setReports(reportsRes.reports);
      }
    } catch (err) {
      setError(
        apiErrorMessage(err, "We couldn't load your compliance status."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmitReport = async (id: number) => {
    try {
      await complianceApi.submitReport(id);
      toast.success("Report submitted for approval.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleApproveReport = async (id: number) => {
    try {
      await complianceApi.approveReport(id);
      toast.success("Report approved.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error) return <ErrorState description={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Compliance"
        description="Your identity verification status and the regulatory record tied to your account."
      />

      <Card
        className={
          status?.is_kyc_approved
            ? "border-gain/30 bg-gain/5"
            : "border-amber-500/30 bg-amber-500/5"
        }
      >
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {status?.is_kyc_approved ? (
              <ShieldCheck className="h-6 w-6 shrink-0 text-gain" />
            ) : (
              <ShieldAlert className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <p className="font-medium">
                {status?.is_kyc_approved
                  ? "Identity verified"
                  : "Verification pending"}
              </p>
              <p className="text-sm text-muted-foreground">
                KYC status: {humanize(status?.kyc_status)} · Risk tier:{" "}
                {humanize(status?.risk_level)}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              status?.trading_enabled
                ? "border-gain/30 text-gain"
                : "border-loss/30 text-loss"
            }
          >
            {status?.trading_enabled ? "Trading enabled" : "Trading disabled"}
          </Badge>
        </CardContent>
      </Card>

      <Tabs defaultValue="records" className="mt-6">
        <TabsList>
          <TabsTrigger value="records">Compliance records</TabsTrigger>
          {isStaff && (
            <TabsTrigger value="reports">Regulatory reports</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {records.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={ShieldCheck}
                    title="No compliance records"
                    description="Nothing has been flagged on your account."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record</TableHead>
                      <TableHead>Framework</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono-num text-xs">
                          {r.record_id}
                        </TableCell>
                        <TableCell>{humanize(r.framework)}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {r.rule_description}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell>
                          {humanize(r.risk_level || undefined)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {r.due_date ? formatDate(r.due_date) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isStaff && (
          <TabsContent value="reports" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Regulatory reports</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {reports.length === 0 ? (
                  <div className="p-5">
                    <EmptyState icon={FileText} title="No reports yet" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Report</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Framework</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="font-medium">{r.title}</p>
                            <p className="font-mono-num text-xs text-muted-foreground">
                              {r.report_id}
                            </p>
                          </TableCell>
                          <TableCell>{humanize(r.report_type)}</TableCell>
                          <TableCell>{humanize(r.framework)}</TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(r.due_date)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSubmitReport(r.id)}
                              >
                                Submit
                              </Button>
                            )}
                            {r.status === "pending_review" &&
                              user?.role === "admin" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApproveReport(r.id)}
                                >
                                  Approve
                                </Button>
                              )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default Compliance;
