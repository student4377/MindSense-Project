import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AuthShell from "@/components/AuthShell";
import { getAuthErrorMessage } from "@/lib/authErrors";
import {
  hasValidationErrors,
  normalizeEmail,
  validateEmail,
  validateRequiredPassword,
  type ValidationErrors,
} from "@/lib/authValidation";

type SignInField = "email" | "password";

const SignIn = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors<SignInField>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, navigate, user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: ValidationErrors<SignInField> = {
      email: validateEmail(email),
      password: validateRequiredPassword(password),
    };
    setErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      return toast({ title: "Check your login details", description: "Correct the highlighted fields and try again.", variant: "destructive" });
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    setLoading(false);
    if (error) return toast({ title: "Sign in failed", description: getAuthErrorMessage(error), variant: "destructive" });
    toast({ title: "Welcome back!" });
    navigate("/dashboard", { replace: true });
  };

  return (
    <AuthShell
      eyebrow="Login"
      title="Welcome back"
      heroTitle="Welcome back to your calm workspace."
      heroDescription="Continue where you left off with your dashboard, reports, mood history, and support tools ready."
      highlights={[
        "Resume your wellness dashboard",
        "Review saved mood and report history",
        "Continue with your protected account",
      ]}
      footer={
        <>
          No account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "signin-email-error" : undefined}
            className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((current) => ({ ...current, email: validateEmail(e.target.value) }));
            }}
          />
          {errors.email && <p id="signin-email-error" className="text-xs text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "signin-password-error" : undefined}
            className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((current) => ({ ...current, password: validateRequiredPassword(e.target.value) }));
            }}
          />
          {errors.password && <p id="signin-password-error" className="text-xs text-destructive">{errors.password}</p>}
        </div>
        <Button type="submit" className="premium-button w-full" disabled={loading || authLoading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default SignIn;
