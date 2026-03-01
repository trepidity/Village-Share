"use client";

import { useEffect } from "react";

/**
 * Client-side fallback: if the server-side callback couldn't read the
 * auth_redirect cookie (e.g. lost during OAuth), pick it up from
 * localStorage and redirect.
 */
export function AuthRedirectHandler() {
  useEffect(() => {
    const redirect = localStorage.getItem("auth_redirect");
    if (redirect) {
      console.log(`[AUTH-REDIRECT] Found pending redirect in localStorage: ${redirect}`);
      localStorage.removeItem("auth_redirect");
      // Only redirect if we're NOT already on the target path
      if (!window.location.pathname.startsWith(redirect)) {
        console.log(`[AUTH-REDIRECT] Redirecting now...`);
        window.location.href = redirect;
      } else {
        console.log(`[AUTH-REDIRECT] Already on target path, skipping redirect`);
      }
    }
  }, []);

  return null;
}
