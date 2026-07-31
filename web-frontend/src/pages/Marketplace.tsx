import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Leaf, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, EmptyState, ErrorState } from "@/components/StatusPieces";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  projectsApi,
  apiErrorMessage,
  type CarbonProject,
} from "@/services/api";
import { formatCurrency, formatNumber, humanize } from "@/lib/format";

const projectTypes = [
  "reforestation",
  "afforestation",
  "renewable_energy",
  "energy_efficiency",
  "methane_capture",
  "carbon_capture",
  "blue_carbon",
  "soil_carbon",
  "waste_management",
  "industrial_process",
];

export function Marketplace() {
  const [projects, setProjects] = useState<CarbonProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await projectsApi.list({
        page,
        per_page: 12,
        type: typeFilter !== "all" ? typeFilter : undefined,
      });
      setProjects(res.projects);
      setPages(res.pages || 1);
    } catch (err) {
      setError(
        apiErrorMessage(err, "We couldn't load the marketplace right now."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, typeFilter]);

  const filtered = projects.filter((p) =>
    search.trim() === ""
      ? true
      : p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.country?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Marketplace"
        title="Verified carbon projects"
        description="Browse projects by type, standard, and geography before placing an order on the trade desk."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by project name or country…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="All project types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All project types</SelectItem>
            {projectTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {humanize(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Leaf}
          title="No projects found"
          description="Try a different search term or project type - or check back soon as new projects are verified."
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <Link key={project.id} to={`/marketplace/${project.id}`}>
                <Card className="group h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Leaf className="h-4 w-4" />
                      </span>
                      <StatusBadge status={project.verification_status} />
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold leading-snug">
                      {project.name}
                    </h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {project.country}
                      {project.region ? `, ${project.region}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {project.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{humanize(project.project_type)}</span>
                      <span>{project.standard || "Unlisted standard"}</span>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Issuance progress</span>
                        <span>
                          {Math.round(project.completion_percentage || 0)}%
                        </span>
                      </div>
                      <Progress
                        value={project.completion_percentage || 0}
                        className="mt-1.5 h-1.5"
                      />
                    </div>

                    <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Est. price
                        </p>
                        <p className="font-mono-num text-sm font-semibold">
                          {project.estimated_credit_price
                            ? formatCurrency(project.estimated_credit_price)
                            : "-"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Available
                        </p>
                        <p className="font-mono-num text-sm font-semibold">
                          {formatNumber(project.available_credits, 0)}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: pages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`h-8 w-8 rounded-md text-sm font-medium ${
                    page === i + 1
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Marketplace;
