import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { hasValidationErrors, normalizeEmail, validateEmail, type ValidationErrors } from "@/lib/authValidation";

type ForgotPasswordField = "email";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ValidationErrors<ForgotPasswordField>>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: ValidationErrors<ForgotPasswordField> = { email: validateEmail(email) };
    setErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      return toast({ title: "Check your email", description: "Enter a valid email address.", variant: "destructive" });
    }

    const normalizedEmail = normalizeEmail(email);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setSent(true);
    toast({ title: "Email sent", description: "Check your inbox for the reset link." });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-bold">Reset password</h1>
          <p className="text-sm text-muted-foreground">We'll email a secure link so you can create a new password.</p>
          {sent ? (
            <div className="mt-6 rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">
              If an account exists for {normalizeEmail(email)}, a reset link has been sent. Open it to set a new password.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "forgot-email-error" : undefined}
                  className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ email: validateEmail(e.target.value) });
                  }}
                />
                {errors.email && <p id="forgot-email-error" className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary-glow" disabled={loading}>
                {loading ? "Sending..." : "Email reset link"}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link to="/signin" className="text-primary font-medium hover:underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
