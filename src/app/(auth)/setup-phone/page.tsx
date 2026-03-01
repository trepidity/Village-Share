"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SetupPhonePage() {
  return (
    <Suspense>
      <SetupPhoneForm />
    </Suspense>
  );
}

function getRedirectFromStorage(): string | null {
  if (typeof window === "undefined") return null;

  // Try cookie first
  const cookieMatch = document.cookie.match(/(?:^|;\s*)auth_redirect=([^;]*)/);
  if (cookieMatch) {
    document.cookie = "auth_redirect=; path=/; max-age=0";
    return decodeURIComponent(cookieMatch[1]);
  }

  // Fall back to localStorage
  const lsValue = localStorage.getItem("auth_redirect");
  if (lsValue) {
    // Don't clear yet — keep for AuthRedirectHandler in case setup-phone redirects to /
    return lsValue;
  }

  return null;
}

function SetupPhoneForm() {
  const searchParams = useSearchParams();
  const paramRedirect = searchParams.get("redirect");
  const storageRedirect = getRedirectFromStorage();
  const redirectTo = paramRedirect || storageRedirect;
  console.log(`[SETUP-PHONE] paramRedirect=${paramRedirect}, storageRedirect=${storageRedirect}, final redirectTo=${redirectTo}`);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sendVerification = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, action: "verify" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, action: "check" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");

      // Update profile with verified phone
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: updateError } = await sb.from("profiles").update({
        phone: data.phone,
        phone_verified: true,
      }).eq("id", user.id);

      if (updateError) throw new Error(updateError.message);

      // Hard redirect to ensure fresh server-side session
      window.location.href = redirectTo || "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Verify Your Phone</CardTitle>
          <CardDescription>
            Add your phone number to send and receive SMS for borrowing items
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {step === "phone" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={sendVerification}
                disabled={loading || !phone}
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to {phone}
              </p>
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={verifyCode}
                disabled={loading || code.length !== 6}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep("phone")}
              >
                Use a different number
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
