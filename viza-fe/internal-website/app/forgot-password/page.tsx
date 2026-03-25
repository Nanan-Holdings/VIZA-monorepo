"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/password-reset";
import { AlertCircle, Loader2, Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const emailValue = formData.get("email") as string;
    setEmail(emailValue);

    try {
      const result = await requestPasswordReset(emailValue);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setIsSuccess(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-4">
        {/* Card */}
        <div className="rounded-[16px] border border-[#efefef] bg-white overflow-hidden">
          {/* Header Section */}
          <div className="px-8 pt-10 pb-6 text-center border-b border-[#efefef]">
            <div className="inline-flex items-center justify-center mb-4">
              <span className="text-4xl font-bold tracking-tight text-[#3d3d3d]">VIZA</span>
            </div>
            <p className="text-[14px] text-[#989898] font-medium">
              VIZA Operations Access
            </p>
          </div>

          {/* Form Section */}
          <div className="px-8 py-8">
            {isSuccess ? (
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-[rgba(239,239,239,0.3)] rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-[#3d3d3d]" />
                </div>
                <h1 className="text-[20px] font-semibold text-[#3d3d3d] mb-2">
                  Check your email
                </h1>
                <p className="text-[14px] text-[#989898] mb-6">
                  If an account exists for <span className="font-medium text-[#3d3d3d]">{email}</span>, you will receive a password reset link shortly.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center w-full rounded-full border border-[#efefef] px-6 py-2.5 text-[14px] font-medium text-[#3d3d3d] hover:border-[#3d3d3d] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to login
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="text-[20px] font-semibold text-[#3d3d3d] mb-1">
                    Reset your password
                  </h1>
                  <p className="text-[14px] text-[#989898]">
                    Enter your email address and we&apos;ll send you a link to reset your password.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-[14px] font-medium text-[#3d3d3d]"
                    >
                      Email address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-[#b0b0b0]" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        required
                        disabled={isSubmitting}
                        className="w-full pl-10 pr-4 py-2.5 rounded-[12px] border border-[#efefef] bg-white text-[14px] text-[#3d3d3d] placeholder:text-[#b0b0b0] outline-none focus:border-[#3d3d3d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-[12px]">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-[14px] text-red-700 font-medium">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-full bg-black px-6 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </span>
                    ) : (
                      "Send reset link"
                    )}
                  </button>

                  {/* Back to Login */}
                  <div className="text-center pt-2">
                    <Link
                      href="/login"
                      className="text-[13px] text-[#989898] hover:text-[#3d3d3d] transition-colors inline-flex items-center gap-1.5"
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
          <p className="text-[13px] text-[#b0b0b0]">
            Secure access for authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
}
