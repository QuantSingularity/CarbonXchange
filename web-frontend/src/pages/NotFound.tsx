import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <Link to="/" className="mb-10">
        <Logo />
      </Link>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="h-6 w-6" />
      </span>
      <p className="mt-6 font-mono-num text-sm text-muted-foreground">
        Error 404
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        This page drifted off the ledger.
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Button asChild className="mt-8">
        <Link to="/">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to home
        </Link>
      </Button>
    </div>
  );
}

export default NotFound;
