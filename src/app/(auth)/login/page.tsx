"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizePhone } from "@/lib/utils/phone";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const signInWithGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });
  };

  const sendOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const normalized = normalizePhone(phone);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) {
        setError(error.message);
        return;
      }
      setStep("otp");
    } catch {
      setError("Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const normalized = normalizePhone(phone);
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        phone: normalized,
        token: otp,
        type: "sms",
      });
      if (error) {
        setError(error.message);
        return;
      }
      // Mark profile as phone-verified and create SMS session
      await fetch("/api/auth/phone-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      window.location.href = "/";
    } catch {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to VillageShare</CardTitle>
          <CardDescription>
            Sign in to start sharing items with your community
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={signInWithGoogle}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {step === "phone" ? (
            <div className="space-y-2">
              <Input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={sendOtp}
                disabled={loading || !phone.trim()}
              >
                {loading ? "Sending..." : "Send Code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Enter the code sent to {phone}
              </p>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={verifyOtp}
                disabled={loading || !otp.trim()}
              >
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setError("");
                }}
              >
                Use a different number
              </Button>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
