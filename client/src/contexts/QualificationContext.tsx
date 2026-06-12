import React, { createContext, useContext, useState, useCallback } from "react";
import { QualificationData } from "@/components/QualificationPrompt";

interface QualificationContextType {
  qualificationData: QualificationData | null;
  hasCompletedQuestionnaire: boolean;
  hasQualified: boolean;
  showQualificationPrompt: boolean;
  setQualificationData: (data: QualificationData) => void;
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
    // ignore
  }
  return null;
}

function store(key: string, value: string | null) {
  try {
    if (value !== null) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function QualificationProvider({ children }: { children: React.ReactNode }) {
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

  const handleSetQualificationData = useCallback((data: QualificationData) => {
    setQualificationDataState(data);
    setShowQualificationPrompt(false);
    store(DATA_KEY, JSON.stringify(data));
  }, []);

  const handleMarkQualified = useCallback(() => {
    setIsUnlocked(true);
    store(UNLOCKED_KEY, "1");
  }, []);

  const handleClearQualification = useCallback(() => {
    setQualificationDataState(null);
    setIsUnlocked(false);
    store(DATA_KEY, null);
    store(UNLOCKED_KEY, null);
  }, []);

  return (
    <QualificationContext.Provider
      value={{
        qualificationData,
        hasCompletedQuestionnaire: qualificationData !== null,
        hasQualified: isUnlocked,
        showQualificationPrompt,
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
