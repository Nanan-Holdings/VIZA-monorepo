"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/app/actions/password-reset";
import { createBrowserClient } from "@supabase/ssr";
import {
  AlertCircle,
  Loader2,
  Lock,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check for valid password recovery session
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Listen for auth state changes to detect PASSWORD_RECOVERY event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
      } else if (session) {
        // User has a valid session (might have already processed recovery)
        setIsValidSession(true);
      }
    });

    // Also check if user already has a session (in case they refreshed the page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      } else {
        // Give some time for the auth state change to fire
        setTimeout(() => {
          setIsValidSession((prev) => (prev === null ? false : prev));
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const validatePassword = () => {
    if (password.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updatePassword(password);

      if (result.error) {
        setError(result.error);
      } else {
        setIsSuccess(true);
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push("/login?reset=success");
        }, 2000);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand mx-auto mb-4" />
          <p className="text-sm text-gray-500">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired token
  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-brand-50/30" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-brand-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-brand-50/50 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 w-full max-w-md px-4">
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100/80 overflow-hidden">
            <div className="px-8 pt-10 pb-6 text-center border-b border-gray-50">
              <div className="inline-flex items-center justify-center mb-4">
                <span className="text-4xl font-bold tracking-tight text-gray-900">VIZA</span>
              </div>
              <p className="text-sm text-gray-500 font-medium">
                VIZA Operations Access
              </p>
            </div>

            <div className="px-8 py-8 text-center">
              <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Invalid or expired link
              </h1>
              <p className="text-sm text-gray-500 mb-6">
                This password reset link has expired or is invalid. Please request a new one.
              </p>
              <div className="space-y-3">
                <Link href="/forgot-password">
                  <Button className="w-full py-2.5 h-auto bg-brand hover:bg-brand-600 text-white font-medium rounded-lg">
                    Request new link
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="outline"
                    className="w-full py-2.5 h-auto border-gray-200 hover:bg-gray-50"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to login
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] relative overflow-hidden">
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-brand-50/30" />

      {/* Decorative elements - subtle geometric accents */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-brand-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-brand-50/50 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100/80 overflow-hidden">
          {/* Header Section */}
          <div className="px-8 pt-10 pb-6 text-center border-b border-gray-50">
            {/* Brand Logo */}
            <div className="inline-flex items-center justify-center mb-4">
              <span className="text-4xl font-bold tracking-tight text-gray-900">VIZA</span>
            </div>

            {/* Subtitle */}
            <p className="text-sm text-gray-500 font-medium">
              VIZA Operations Access
            </p>
          </div>

          {/* Form Section */}
          <div className="px-8 py-8">
            {isSuccess ? (
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">
                  Password updated
                </h1>
                <p className="text-sm text-gray-500 mb-4">
                  Your password has been successfully updated. Redirecting to login...
                </p>
                <Loader2 className="h-5 w-5 animate-spin text-brand mx-auto" />
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-semibold text-gray-900 mb-1">
                    Set new password
                  </h1>
                  <p className="text-sm text-gray-500">
                    Enter your new password below.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="text-sm font-medium text-gray-700"
                    >
                      New password
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Enter new password"
                        required
                        disabled={isSubmitting}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="
                          w-full pl-10 pr-10 py-2.5
                          bg-gray-50/50 border border-gray-200 rounded-lg
                          text-gray-900 text-sm placeholder:text-gray-400
                          transition-all duration-200 ease-out
                          hover:border-gray-300 hover:bg-gray-50
                          focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand focus:bg-white
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-gray-50/50
                        "
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Must be at least 8 characters
                    </p>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="confirmPassword"
                      className="text-sm font-medium text-gray-700"
                    >
                      Confirm password
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Confirm new password"
                        required
                        disabled={isSubmitting}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="
                          w-full pl-10 pr-10 py-2.5
                          bg-gray-50/50 border border-gray-200 rounded-lg
                          text-gray-900 text-sm placeholder:text-gray-400
                          transition-all duration-200 ease-out
                          hover:border-gray-300 hover:bg-gray-50
                          focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand focus:bg-white
                          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-gray-50/50
                        "
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-100 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-600 font-medium">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="
                      w-full py-2.5 h-auto
                      bg-brand hover:bg-brand-600 active:bg-brand-700
                      text-white font-medium
                      rounded-lg shadow-sm shadow-brand/20
                      transition-all duration-200 ease-out
                      hover:shadow-md hover:shadow-brand/25
                      disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-sm
                    "
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Updating...
                      </span>
                    ) : (
                      "Update password"
                    )}
                  </Button>

                  {/* Back to Login */}
                  <div className="text-center pt-2">
                    <Link
                      href="/login"
                      className="text-sm text-gray-500 hover:text-brand transition-colors inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to login
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Secure access for authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
}
