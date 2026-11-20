"use client";

import { createContext, useContext } from "react";
import { useTranslations } from "@/lib/i18n";
import { useSmeQuiz, type SmeQuizState } from "./use-sme-quiz";

type Translate = ReturnType<typeof useTranslations>["t"];

interface SmeQuizContextValue extends SmeQuizState {
  t: Translate;
  locale: string;
  getSessionId: () => string;
}

const SmeQuizCtx = createContext<SmeQuizContextValue | null>(null);

export function useSmeQuizContext() {
  const value = useContext(SmeQuizCtx);
  if (!value) {
    throw new Error("useSmeQuizContext must be used within SmeQuizProvider");
  }
  return value;
}

export function SmeQuizProvider({
  getSessionId,
  children,
}: {
  getSessionId: () => string;
  children: React.ReactNode;
}) {
  const quiz = useSmeQuiz();
  const { t, locale } = useTranslations();
  return (
    <SmeQuizCtx.Provider value={{ ...quiz, t, locale, getSessionId }}>
      {children}
    </SmeQuizCtx.Provider>
  );
}
