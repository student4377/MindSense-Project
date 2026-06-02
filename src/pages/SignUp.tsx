import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
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
  normalizeName,
  validateConfirmPassword,
  validateEmail,
  validateName,
  validateNewPassword,
  type ValidationErrors,
} from "@/lib/authValidation";

type SignUpField = "name" | "email" | "password" | "confirmPassword";

const duplicateEmailMessage = "This email already exists. Sign in or reset your password.";

const isDuplicateEmailError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes("already registered") || normalized.includes("already exists") || normalized.includes("user already");
};

const SignUp = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [errors, setErrors] = useState<ValidationErrors<SignUpField>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, navigate, user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: ValidationErrors<SignUpField> = {
      name: validateName(name),
      email: validateEmail(email),
      password: validateNewPassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
    };
    setErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      return toast({ title: "Check your signup details", description: "Correct the highlighted fields and try again.", variant: "destructive" });
    }

    const normalizedEmail = normalizeEmail(email);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name: normalizeName(name) },
      },
    });
    setLoading(false);

    if (error) {
      if (isDuplicateEmailError(error.message)) {
        setErrors({ email: duplicateEmailMessage });
        return toast({ title: "Email already exists", description: "Use login or forgot password instead.", variant: "destructive" });
      }

      return toast({ title: "Sign up failed", description: getAuthErrorMessage(error), variant: "destructive" });
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setErrors({ email: duplicateEmailMessage });
      return toast({ title: "Email already exists", description: "Use login or forgot password instead.", variant: "destructive" });
    }

    if (data.session) {
      toast({ title: "Account created", description: "Welcome to MindSense!" });
      navigate("/dashboard", { replace: true });
      return;
    }

    setConfirmationEmail(normalizedEmail);
    toast({ title: "Check your email", description: "Confirm your account before signing in." });
  };

  if (confirmationEmail) {
    return (
      <AuthShell
        eyebrow="Signup"
        title="Check your email"
        description="Supabase needs email confirmation before opening your MindSense dashboard."
        heroTitle="Create a private space for your wellness signals."
        heroDescription="MindSense keeps your assessments, mood entries, and reports organized from the first check-in."
        highlights={[
          "Start with guided check-ins",
          "Keep mood history organized",
          "Use AI support when needed",
        ]}
        compact
        footer={
          <>
            Already confirmed?{" "}
            <Link to="/signin" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{confirmationEmail}</span>.
            Open that link to activate your account.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-5 rounded-full border-white/10 bg-white/[0.04]"
            onClick={() => setConfirmationEmail("")}
          >
            Use a different email
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Signup"
      title="Create your account"
      heroTitle="Create a private space for your wellness signals."
      heroDescription="MindSense helps new users begin with guided check-ins, organized mood history, and calmer reports."
      highlights={[
        "Start with a guided assessment",
        "Track mood patterns over time",
        "Build a private report history",
      ]}
      compact
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "signup-name-error" : undefined}
              className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name || e.target.value) setErrors((current) => ({ ...current, name: validateName(e.target.value) }));
              }}
            />
            {errors.name && <p id="signup-name-error" className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email || e.target.value) setErrors((current) => ({ ...current, email: validateEmail(e.target.value) }));
              }}
            />
            {errors.email && <p id="signup-email-error" className="text-xs text-destructive">{errors.email}</p>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "signup-password-error" : undefined}
              className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
              onChange={(e) => {
                const nextPassword = e.target.value;
                setPassword(nextPassword);
                setErrors((current) => ({
                  ...current,
                  password: current.password || nextPassword ? validateNewPassword(nextPassword) : "",
                  confirmPassword: confirmPassword ? validateConfirmPassword(nextPassword, confirmPassword) : current.confirmPassword,
                }));
              }}
            />
            {errors.password && <p id="signup-password-error" className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-sm">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? "signup-confirm-password-error" : undefined}
              className={errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword || e.target.value) {
                  setErrors((current) => ({ ...current, confirmPassword: validateConfirmPassword(password, e.target.value) }));
                }
              }}
            />
            {errors.confirmPassword && (
              <p id="signup-confirm-password-error" className="text-xs text-destructive">{errors.confirmPassword}</p>
            )}
          </div>
        </div>
        <Button type="submit" className="premium-button w-full" disabled={loading || authLoading}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default SignUp;
