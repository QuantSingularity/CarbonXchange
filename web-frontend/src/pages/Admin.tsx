import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Activity, Unlock, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, EmptyState, ErrorState } from "@/components/StatusPieces";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  adminApi,
  complianceApi,
  apiErrorMessage,
  type User,
  type SystemInfo,
  type AmlSummary,
  type UserStatus,
} from "@/services/api";
import {
  formatDate,
  formatNumber,
  formatPercent,
  humanize,
} from "@/lib/format";

const statusOptions: UserStatus[] = [
  "pending",
  "active",
  "suspended",
  "closed",
  "under_review",
  "locked",
  "dormant",
];

export function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [aml, setAml] = useState<AmlSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, systemRes, amlRes] = await Promise.allSettled([
        adminApi.users({
          per_page: 25,
          role: roleFilter !== "all" ? roleFilter : undefined,
        }),
        adminApi.system(),
        complianceApi.amlSummary(),
      ]);
      if (usersRes.status === "fulfilled") setUsers(usersRes.value.users);
      else
        setError(apiErrorMessage(usersRes.reason, "We couldn't load users."));
      if (systemRes.status === "fulfilled") setSystem(systemRes.value);
      if (amlRes.status === "fulfilled") setAml(amlRes.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const handleStatusChange = async (userId: number, status: UserStatus) => {
    setUpdatingId(userId);
    try {
      await adminApi.updateUserStatus(userId, status);
      toast.success("User status updated.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUnlock = async (userId: number) => {
    setUpdatingId(userId);
    try {
      await adminApi.unlockUser(userId);
      toast.success("User account unlocked.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Admin console"
        description="Manage user accounts, monitor platform health, and review AML exposure."
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total users"
            value={system ? formatNumber(system.users.total, 0) : "—"}
            icon={Users}
            hint={
              system
                ? `${formatNumber(system.users.active, 0)} active`
                : undefined
            }
          />
          <StatCard
            label="Orders placed"
            value={system ? formatNumber(system.trading.orders, 0) : "—"}
            icon={Activity}
          />
          <StatCard
            label="Trades settled"
            value={system ? formatNumber(system.trading.trades, 0) : "—"}
            icon={Activity}
          />
          <StatCard
            label="KYC approval rate"
            value={aml ? formatPercent(aml.kyc_approval_rate) : "—"}
            icon={ShieldAlert}
            hint={
              aml
                ? `${formatNumber(aml.open_compliance_issues, 0)} open issues`
                : undefined
            }
          />
        </div>
      )}

      <Tabs defaultValue="users" className="mt-6">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="platform">Platform</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <div className="mb-4 flex items-center gap-3">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
                <SelectItem value="institutional">Institutional</SelectItem>
                <SelectItem value="broker">Broker</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="compliance_officer">
                  Compliance officer
                </SelectItem>
                <SelectItem value="auditor">Auditor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="p-5">
                  <ErrorState description={error} onRetry={load} />
                </div>
              ) : users.length === 0 ? (
                <div className="p-5">
                  <EmptyState icon={Users} title="No users found" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>KYC</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.full_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.email}
                        </TableCell>
                        <TableCell>{humanize(u.role)}</TableCell>
                        <TableCell>
                          <StatusBadge status={u.status} />
                        </TableCell>
                        <TableCell>
                          {u.is_kyc_approved ? "Verified" : "Pending"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(u.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              value={u.status}
                              onValueChange={(v) =>
                                handleStatusChange(u.id, v as UserStatus)
                              }
                              disabled={updatingId === u.id}
                            >
                              <SelectTrigger className="h-8 w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {humanize(s)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {u.status === "locked" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleUnlock(u.id)}
                                disabled={updatingId === u.id}
                              >
                                <Unlock className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Platform activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total users</span>
                  <span className="font-mono-num">
                    {system ? formatNumber(system.users.total, 0) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active users</span>
                  <span className="font-mono-num">
                    {system ? formatNumber(system.users.active, 0) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Orders placed</span>
                  <span className="font-mono-num">
                    {system ? formatNumber(system.trading.orders, 0) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trades settled</span>
                  <span className="font-mono-num">
                    {system ? formatNumber(system.trading.trades, 0) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Verified projects
                  </span>
                  <span className="font-mono-num">
                    {system ? formatNumber(system.carbon.projects, 0) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit batches</span>
                  <span className="font-mono-num">
                    {system ? formatNumber(system.carbon.credits, 0) : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AML summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">KYC approved</span>
                  <span className="font-mono-num">
                    {aml ? formatNumber(aml.kyc_approved_users, 0) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approval rate</span>
                  <span className="font-mono-num">
                    {aml ? formatPercent(aml.kyc_approval_rate) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Open issues</span>
                  <span className="font-mono-num">
                    {aml ? formatNumber(aml.open_compliance_issues, 0) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Total compliance records
                  </span>
                  <span className="font-mono-num">
                    {aml ? formatNumber(aml.total_compliance_records, 0) : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Admin;
