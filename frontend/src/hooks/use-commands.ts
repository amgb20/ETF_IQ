import { useState, useCallback } from "react";

const STORAGE_KEY = "piq_user_commands";

export interface UserCommand {
  id: string;
  label: string;
  prompt: string;
}

const DEFAULT_COMMANDS: UserCommand[] = [
  { id: "summary-asia", label: "Asia summary", prompt: "Give me a summary of my positions on the Asian market" },
  { id: "top-performers", label: "Top performers", prompt: "What are my top performing ETFs this month?" },
  { id: "risk-check", label: "Risk check", prompt: "Analyze the risk exposure of my current portfolio" },
];

function loadCommands(): UserCommand[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as UserCommand[];
  } catch {
    /* corrupted — fall back to defaults */
  }
  return DEFAULT_COMMANDS;
}

function saveCommands(commands: UserCommand[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
}

export function useCommands() {
  const [commands, setCommands] = useState<UserCommand[]>(loadCommands);

  const addCommand = useCallback((label: string, prompt: string) => {
    const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next = [...loadCommands(), { id, label, prompt }];
    saveCommands(next);
    setCommands(next);
  }, []);

  const removeCommand = useCallback((id: string) => {
    const next = loadCommands().filter((c) => c.id !== id);
    saveCommands(next);
    setCommands(next);
  }, []);

  const resetDefaults = useCallback(() => {
    saveCommands(DEFAULT_COMMANDS);
    setCommands(DEFAULT_COMMANDS);
  }, []);

  return { commands, addCommand, removeCommand, resetDefaults };
}
