"use client";

import {
  SessionProvider,
  useSession,
} from "next-auth/react";

import { useEffect, useState } from "react";
import { clearPortalCache } from "@/lib/portal-cache";

function SessionCacheGuard({ onRecoveryChange }: { onRecoveryChange: (recovering: boolean) => void }) {
  const { data: session, status } = useSession();
  const recovering = Boolean(session?.user?.authVerificationPending || session?.user?.authDegraded);
  useEffect(() => {
    if (status === "unauthenticated") clearPortalCache();
  }, [status]);
  useEffect(() => {
    onRecoveryChange(recovering);
  }, [recovering, onRecoveryChange]);
  return recovering ? (
    <div className="authRecoveryNotice" role="status">
      인증 서버 연결을 다시 확인하고 있어요. 재인증 없이 자동으로 복구합니다.
    </div>
  ) : null;
}


export default function SessionProviderClient({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const [recovering, setRecovering] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const changed = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  return (
    <SessionProvider refetchInterval={visible ? recovering ? 10 : 60 : 0} refetchWhenOffline={false}>
      <SessionCacheGuard onRecoveryChange={setRecovering} />
      {children}
    </SessionProvider>
  );
}
