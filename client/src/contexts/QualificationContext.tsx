import React, { createContext, useContext, useState, useCallback } from "react";
import { QualificationData } from "@/components/QualificationPrompt";

interface QualificationContextType {
  qualificationData: QualificationData | null;
  hasQualified: boolean;
  showQualificationPrompt: boolean;
  setQualificationData: (data: QualificationData) => void;
  setShowQualificationPrompt: (show: boolean) => void;
  clearQualification: () => void;
}

const QualificationContext = createContext<QualificationContextType | undefined>(undefined);

export function QualificationProvider({ children }: { children: React.ReactNode }) {
  const [qualificationData, setQualificationData] = useState<QualificationData | null>(null);
  const [showQualificationPrompt, setShowQualificationPrompt] = useState(false);

  const handleSetQualificationData = useCallback((data: QualificationData) => {
    setQualificationData(data);
    setShowQualificationPrompt(false);
    // Store in localStorage for persistence
    localStorage.setItem("qualification_data", JSON.stringify(data));
  }, []);

  const handleClearQualification = useCallback(() => {
    setQualificationData(null);
    localStorage.removeItem("qualification_data");
  }, []);

  return (
    <QualificationContext.Provider
      value={{
        qualificationData,
        hasQualified: qualificationData !== null,
        showQualificationPrompt,
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
