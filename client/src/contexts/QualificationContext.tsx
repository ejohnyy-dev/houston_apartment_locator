import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { QualificationData } from "@/components/QualificationPrompt";
import { trpc } from "@/lib/trpc";

interface QualificationContextType {
  /** Questionnaire answers (stored locally; survives reloads on the same device). */
  qualificationData: QualificationData | null;
  /** True once the visitor has answered the questionnaire. Does NOT unlock listings. */
  hasCompletedQuestionnaire: boolean;
  /** True once the visitor has also submitted contact info (server-verified lead). Unlocks full details. */
  hasQualified: boolean;
  showQualificationPrompt: boolean;
  isCheckingServer: boolean;
  setQualificationData: (data: QualificationData) => void;
  /** Call after a successful inquiry submission to lift the lead gate. */
  markQualified: () => void;
  setShowQualificationPrompt: (show: boolean) => void;
  clearQualification: () => void;
}

const QualificationContext = createContext<QualificationContextType | undefined>(undefined);

const DATA_KEY = "qualification_data";
const UNLOCKED_KEY = "qualification_unlocked";

function loadStoredQualification(): QualificationData | null {
  try {
    const stored = localStorage.getItem(DATA_KEY);
    if (stored) return JSON.parse(stored) as QualificationData;
  } catch {
    // ignore parse errors
  }
  return null;
}

function storeQualification(data: QualificationData | null) {
  try {
    if (data) {
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(DATA_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function storeUnlocked(unlocked: boolean) {
  try {
    if (unlocked) {
      localStorage.setItem(UNLOCKED_KEY, "1");
    } else {
      localStorage.removeItem(UNLOCKED_KEY);
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
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(UNLOCKED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [showQualificationPrompt, setShowQualificationPrompt] = useState(false);
  const [hasCheckedServer, setHasCheckedServer] = useState(false);

  // Server-side check: runs on mount to verify the qual_session cookie.
  // This is the authoritative source of truth for the lead gate (cross-session persistence).
  const { data: serverCheck, isLoading: isCheckingServer } =
    trpc.qualification.check.useQuery(undefined, {
      staleTime: 5 * 60 * 1000, // 5 min — don't re-check on every focus
      retry: false,
    });

  // Reconcile the lead gate with the server.
  // The questionnaire answers are intentionally NOT cleared when the server says
  // "not qualified": answering the questionnaire and becoming a verified lead are
  // separate steps, and wiping the answers caused visitors to be re-prompted on
  // every visit until they submitted contact info.
  useEffect(() => {
    if (!serverCheck) return;
    setHasCheckedServer(true);

    if (serverCheck.qualified) {
      setIsUnlocked(true);
      storeUnlocked(true);
      setShowQualificationPrompt(false);
      if (serverCheck.qualificationData) {
        const data = serverCheck.qualificationData as QualificationData;
        setQualificationDataState(data);
        storeQualification(data);
      }
    } else {
      setIsUnlocked(false);
      storeUnlocked(false);
    }
  }, [serverCheck]);

  const handleSetQualificationData = useCallback((data: QualificationData) => {
    setQualificationDataState(data);
    setShowQualificationPrompt(false);
    storeQualification(data);
  }, []);

  const handleMarkQualified = useCallback(() => {
    setIsUnlocked(true);
    storeUnlocked(true);
  }, []);

  const handleClearQualification = useCallback(() => {
    setQualificationDataState(null);
    setIsUnlocked(false);
    storeQualification(null);
    storeUnlocked(false);
  }, []);

  return (
    <QualificationContext.Provider
      value={{
        qualificationData,
        hasCompletedQuestionnaire: qualificationData !== null,
        hasQualified: isUnlocked,
        showQualificationPrompt,
        isCheckingServer: isCheckingServer && !hasCheckedServer,
        setQualificationData: handleSetQualificationData,
        markQualified: handleMarkQualified,
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
