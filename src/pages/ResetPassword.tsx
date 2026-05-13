import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import {
  hasValidationErrors,
  validateConfirmPassword,
  validateNewPassword,
  type ValidationErrors,
} from "@/lib/authValidation";

type ResetPasswordField = "password" | "confirmPassword";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors<ResetPasswordField>>({});
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        resolved = true;
        setHasSession(!!session);
        setChecking(false);
      }
    });

    // Give Supabase a moment to process the recovery URL hash
    const timer = setTimeout(async () => {
      if (resolved) return;
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      setChecking(false);
    }, 800);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: ValidationErrors<ResetPasswordField> = {
      password: validateNewPassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
    };
    setErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      return toast({ title: "Check your password", description: "Correct the highlighted fields and try again.", variant: "destructive" });
    }

    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      setHasSession(false);
      return toast({ title: "Invalid or expired reset link", description: "Please request a new reset link.", variant: "destructive" });
    }
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Password updated" });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          {checking ? (
            <p className="text-center text-sm text-muted-foreground">Verifying reset link...</p>
          ) : !hasSession ? (
            <div className="space-y-4 text-center">
              <h1 className="text-2xl font-bold">Invalid or expired reset link</h1>
              <p className="text-sm text-muted-foreground">
                Your password reset link is no longer valid. Please request a new one.
              </p>
              <Button asChild className="w-full bg-gradient-to-r from-primary to-primary-glow">
                <Link to="/forgot-password">Request new reset link</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Set new password</h1>
              <p className="text-sm text-muted-foreground">Enter your new password below.</p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    minLength={6}
                    value={password}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "reset-password-error" : undefined}
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
                  {errors.password && <p id="reset-password-error" className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? "reset-confirm-password-error" : undefined}
                    className={errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword || e.target.value) {
                        setErrors((current) => ({ ...current, confirmPassword: validateConfirmPassword(password, e.target.value) }));
                      }
                    }}
                  />
                  {errors.confirmPassword && (
                    <p id="reset-confirm-password-error" className="text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-glow" disabled={loading}>
                  {loading ? "Updating..." : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
