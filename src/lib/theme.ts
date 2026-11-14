"use client";

import { useSyncExternalStore } from "react";

// Light / dark mode.
//
// Default = follow the visitor's device ("system"). The toggle stores an
// explicit choice in localStorage and sets <html data-theme="light|dark">;
// the CSS in app/globals.css does the rest. The inline script in
// app/layout.tsx applies a stored choice before the first paint, so the
// page never flashes the wrong mode.
//
// Components only need the hooks below when something can't be done in
// CSS — the map and the team display colors (lib/teamColors.ts).

export type Theme = "light" | "dark";
export type ThemeChoice = Theme | "system";

export const THEME_STORAGE_KEY = "fanmap_theme";
const CHANGE_EVENT = "fanmap:theme-change";

function readChoice(): ThemeChoice {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

function readTheme(): Theme {
  const choice = readChoice();
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function setThemeChoice(choice: ThemeChoice): void {
  if (choice === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = choice;
  }
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked (private mode etc.) — the choice still applies for
    // this page view, it just won't be remembered.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  window.addEventListener(CHANGE_EVENT, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    media.removeEventListener("change", onChange);
  };
}

// The mode actually shown right now. On the server (and the first client
// render) it reports "dark"; useSyncExternalStore then switches to the real
// value without a hydration error — same pattern as lib/useClientValue.ts.
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "dark");
}

// What the visitor picked: "system" until they use the toggle.
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => "system");
}
