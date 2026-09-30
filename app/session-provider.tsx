"use client";

import {
  SessionProvider,
  useSession,
} from "next-auth/react";

import { useEffect } from "react";
import { clearPortalCache } from "@/lib/portal-cache";

function SessionCacheGuard() {
  const { status } = useSession();
  useEffect(() => {
    if (status === "unauthenticated") clearPortalCache();
  }, [status]);
  return null;
}


export default function SessionProviderClient({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <SessionProvider>
      <SessionCacheGuard />
      {children}
    </SessionProvider>
  );
}
