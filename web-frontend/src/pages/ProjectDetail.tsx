import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  CalendarRange,
  Leaf,
  ShieldCheck,
  Layers,
  Recycle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, EmptyState, ErrorState } from "@/components/StatusPieces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  projectsApi,
  creditsApi,
  apiErrorMessage,
  type CarbonProject,
  type CarbonCredit,
} from "@/services/api";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  humanize,
} from "@/lib/format";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<CarbonProject | null>(null);
  const [credits, setCredits] = useState<CarbonCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retiringId, setRetiringId] = useState<number | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await projectsApi.credits(Number(id));
      setProject(res.project);
      setCredits(res.credits);
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't load this project."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleRetire = async (creditId: number) => {
    setRetiringId(creditId);
    try {
      await creditsApi.retire(creditId);
      toast.success("Credit retired permanently.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "This credit couldn't be retired."));
    } finally {
      setRetiringId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <ErrorState description={error ?? "Project not found."} onRetry={load} />
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        onClick={() => navigate("/marketplace")}
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back to marketplace
      </Button>

      <PageHeader
        eyebrow={humanize(project.project_type)}
        title={project.name}
        description={project.description}
        actions={
          <Button asChild>
            <Link
              to={`/trade?credit_type=${encodeURIComponent(project.project_type)}`}
            >
              Trade this credit type
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Location
            </p>
            <p className="mt-1 font-medium">
              {project.country}
              {project.region ? `, ${project.region}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Standard
            </p>
            <p className="mt-1 font-medium">{project.standard || "Unlisted"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Available credits
            </p>
            <p className="mt-1 font-mono-num font-medium">
              {formatNumber(project.available_credits, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" /> Est. price
            </p>
            <p className="mt-1 font-mono-num font-medium">
              {project.estimated_credit_price
                ? formatCurrency(project.estimated_credit_price)
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Verification &amp; issuance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Validation</p>
                <StatusBadge
                  status={project.validation_status}
                  className="mt-1"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Verification</p>
                <StatusBadge
                  status={project.verification_status}
                  className="mt-1"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <StatusBadge status={project.status} className="mt-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Methodology</p>
                <p className="mt-1 font-medium">{project.methodology || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Developer</p>
                <p className="mt-1 font-medium">
                  {project.developer_name || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project ID</p>
                <p className="mt-1 font-mono-num font-medium">
                  {project.project_id}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Issuance progress</span>
                <span>{Math.round(project.completion_percentage || 0)}%</span>
              </div>
              <Progress
                value={project.completion_percentage || 0}
                className="mt-1.5 h-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {formatNumber(project.actual_reductions_to_date, 0)} of{" "}
                {formatNumber(project.total_emission_reductions, 0)} tCO&#8322;e
                reduced to date
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Start date</p>
                <p className="mt-1 font-medium">
                  {formatDate(project.project_start_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">End date</p>
                <p className="mt-1 font-medium">
                  {formatDate(project.project_end_date)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Risk rating</p>
                <p className="mt-1 font-medium">
                  {humanize(project.overall_risk_rating || undefined)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issuance summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total issued</span>
              <span className="font-mono-num font-medium">
                {formatNumber(project.total_credits_issued, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available</span>
              <span className="font-mono-num font-medium">
                {formatNumber(project.available_credits, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Recycle className="h-3.5 w-3.5" /> Retired
              </span>
              <span className="font-mono-num font-medium">
                {formatNumber(project.retired_credits, 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Credit batches</CardTitle>
        </CardHeader>
        <CardContent>
          {credits.length === 0 ? (
            <EmptyState icon={Leaf} title="No credit batches listed yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial</TableHead>
                  <TableHead>Vintage</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Market price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono-num text-xs">
                      {c.serial_number}
                    </TableCell>
                    <TableCell>{c.vintage_year}</TableCell>
                    <TableCell className="font-mono-num">
                      {formatNumber(c.quantity, 0)}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {c.market_price ? formatCurrency(c.market_price) : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {c.is_available && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={retiringId === c.id}
                          onClick={() => handleRetire(c.id)}
                        >
                          Retire
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
    </div>
  );
}

export default ProjectDetail;
