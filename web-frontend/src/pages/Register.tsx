import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { AuthAside } from "@/components/AuthAside";
import { useAuth } from "@/contexts/AuthContext";
import { apiErrorMessage } from "@/services/api";

const passwordRules = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "One number", test: (v: string) => /\d/.test(v) },
  {
    label: "One special character",
    test: (v: string) => /[!@#$%^&*(),.?":{}|<>]/.test(v),
  },
];

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    company_name: "",
    password: "",
    confirm_password: "",
  });
  const [accountType, setAccountType] = useState<"individual" | "corporate">(
    "individual",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm_password) {
      setError("Passwords don't match.");
      return;
    }
    if (passwordRules.some((r) => !r.test(form.password))) {
      setError("Your password doesn't meet the requirements below.");
      return;
    }

    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone_number: form.phone_number || undefined,
        company_name:
          accountType === "corporate"
            ? form.company_name || undefined
            : undefined,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "We couldn't create your account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/">
            <Logo />
          </Link>
          <h1 className="mt-8 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Open an account
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Takes about two minutes. You&rsquo;ll complete KYC verification
            after signing up.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-md bg-secondary p-1">
            {(["individual", "corporate"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAccountType(t)}
                className={`rounded-sm py-1.5 text-sm font-medium capitalize transition-colors ${
                  accountType === t
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name">First name</Label>
                <Input
                  id="first_name"
                  required
                  value={form.first_name}
                  onChange={update("first_name")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name">Last name</Label>
                <Input
                  id="last_name"
                  required
                  value={form.last_name}
                  onChange={update("last_name")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={update("email")}
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone_number">
                Phone number{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="phone_number"
                type="tel"
                value={form.phone_number}
                onChange={update("phone_number")}
                placeholder="+1 555 000 0000"
              />
            </div>

            {accountType === "corporate" && (
              <div className="space-y-1.5">
                <Label htmlFor="company_name">Company name</Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={update("company_name")}
                  placeholder="Acme Industries, Inc."
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={update("password")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password">Confirm password</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                value={form.confirm_password}
                onChange={update("confirm_password")}
              />
            </div>

            <ul className="space-y-1 rounded-md bg-secondary/60 p-3">
              {passwordRules.map((r) => {
                const met = r.test(form.password);
                return (
                  <li key={r.label} className="flex items-center gap-2 text-xs">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full ${
                        met
                          ? "bg-gain text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    <span
                      className={
                        met ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {r.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Create account
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree to complete identity verification before
              trading, per our compliance policy.
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <AuthAside
        quote="Verification isn't a gate to get through once — it's the reason counterparties trust the ledger."
        caption="KYC / AML onboarding"
      />
    </div>
  );
}

export default Register;
