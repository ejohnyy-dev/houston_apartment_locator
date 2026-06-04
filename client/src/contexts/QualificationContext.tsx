import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { QualificationData } from "@/components/QualificationPrompt";
import { trpc } from "@/lib/trpc";

interface QualificationContextType {
  qualificationData: QualificationData | null;
  hasQualified: boolean;
  showQualificationPrompt: boolean;
  isCheckingServer: boolean;
  setQualificationData: (data: QualificationData) => void;
  setShowQualificationPrompt: (show: boolean) => void;
  clearQualification: () => void;
}

const QualificationContext = createContext<QualificationContextType | undefined>(undefined);

function loadStoredQualification(): QualificationData | null {
  try {
    const stored = localStorage.getItem("qualification_data");
    if (stored) return JSON.parse(stored) as QualificationData;
  } catch {
    // ignore parse errors
  }
  return null;
}

function storeQualification(data: QualificationData | null) {
  try {
    if (data) {
      localStorage.setItem("qualification_data", JSON.stringify(data));
    } else {
      localStorage.removeItem("qualification_data");
    }
  } catch {
    // ignore storage errors
  }
}

export function QualificationProvider({ children }: { children: React.ReactNode }) {
  // Initialise from localStorage for instant UI (no flash on repeat visits, same device)
  const [qualificationData, setQualificationDataState] = useState<QualificationData | null>(
    () => loadStoredQualification()
  );
  const [showQualificationPrompt, setShowQualificationPrompt] = useState(false);
  const [hasCheckedServer, setHasCheckedServer] = useState(false);

  // Server-side check: runs on mount to verify the qual_session cookie.
  // This is the authoritative source of truth for cross-session / cross-device persistence.
  // Even if localStorage has data, we reconcile with the server to ensure the session is still valid.
  const { data: serverCheck, isLoading: isCheckingServer } =
    trpc.qualification.check.useQuery(undefined, {
      staleTime: 5 * 60 * 1000, // 5 min — don't re-check on every focus
      retry: false,
    });

  // When the server responds, reconcile qualification state.
  // If server says qualified, trust it (even if localStorage says otherwise).
  // If server says not qualified, clear local state.
  useEffect(() => {
    if (!serverCheck) return;
    setHasCheckedServer(true);
    
    if (serverCheck.qualified && serverCheck.qualificationData) {
      const data = serverCheck.qualificationData as QualificationData;
      setQualificationDataState(data);
      storeQualification(data);
    } else {
      // Server says not qualified — clear local state to match
      setQualificationDataState(null);
      storeQualification(null);
    }
  }, [serverCheck]);

  const handleSetQualificationData = useCallback((data: QualificationData) => {
    setQualificationDataState(data);
    setShowQualificationPrompt(false);
    storeQualification(data);
  }, []);

  const handleClearQualification = useCallback(() => {
    setQualificationDataState(null);
    storeQualification(null);
  }, []);

  return (
    <QualificationContext.Provider
      value={{
        qualificationData,
        hasQualified: qualificationData !== null,
        showQualificationPrompt,
        isCheckingServer: isCheckingServer && !hasCheckedServer,
        setQualificationData: handleSetQualificationData,
        setShowQualificationPrompt,
        clearQualification: handleClearQualification,
      }}
    >
      {children}
    </QualificationContext.Provider>
  );
}

export function useQualification() {
  const context = useContext(QualificationContext);
  if (context === undefined) {
    throw new Error("useQualification must be used within QualificationProvider");
  }
  return context;
}
