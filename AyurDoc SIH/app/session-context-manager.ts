"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deriveWorkflowState,
  type GuideLanguage,
  type SessionWorkflowContext,
  type WorkflowSignals,
  type WorkflowStage,
} from "@/lib/workflow-state";

export function useSessionContextManager(input: {
  username: string;
  language: GuideLanguage;
  signals: WorkflowSignals;
}) {
  const derived = useMemo(() => deriveWorkflowState(input.signals), [input.signals]);
  const stateRef = useRef<WorkflowStage | null>(null);
  const [previousState, setPreviousState] = useState<WorkflowStage | null>(null);
  const [lastAction, setLastAction] = useState("session-started");

  useEffect(() => {
    const storageKey = `ayurdoc-session-context:${input.username}`;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || "null") as Partial<SessionWorkflowContext> | null;
      if (saved?.previousState || saved?.lastAction) {
        const restoreTimer = window.setTimeout(() => {
          if (saved?.previousState) setPreviousState(saved.previousState);
          if (saved?.lastAction) setLastAction(saved.lastAction);
        }, 0);
        return () => window.clearTimeout(restoreTimer);
      }
    } catch {
      // A damaged browser draft must not block the clinical workflow.
    }
  }, [input.username]);

  useEffect(() => {
    if (stateRef.current && stateRef.current !== derived.currentState) {
      setPreviousState(stateRef.current);
      setLastAction(`moved-to-${derived.currentState}`);
    }
    stateRef.current = derived.currentState;
  }, [derived.currentState]);

  const context = useMemo<SessionWorkflowContext>(() => ({
    ...derived,
    previousState,
    selectedLanguage: input.language,
    lastAction,
  }), [derived, previousState, input.language, lastAction]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(`ayurdoc-session-context:${input.username}`, JSON.stringify(context));
    } catch {
      // In-memory context remains available when browser storage is restricted.
    }
  }, [context, input.username]);

  const recordAction = useCallback((action: string) => setLastAction(action), []);
  return { context, recordAction };
}
