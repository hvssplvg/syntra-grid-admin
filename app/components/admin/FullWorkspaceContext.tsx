"use client";

// Lets a Standard-workspace tab (today: only Social Media's Graphic
// Studio) opt into the dashboard's existing full-bleed content layout
// (today: used only by Overview/Analytics/Activity/Calendar/
// Notifications via isCommandWorkspace in AdminShell.tsx) without
// reclassifying that tab as a Command section — see the Content Studio
// plan ("full-workspace editor") for why. Defaults to `false` and is
// never set anywhere except the Graphic Studio, so every other tab's
// layout is completely unaffected.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type FullWorkspaceContextValue = {
  full: boolean;
  setFull: (value: boolean) => void;
};

const FullWorkspaceContext = createContext<FullWorkspaceContextValue>({
  full: false,
  setFull: () => {},
});

export function FullWorkspaceProvider({ children }: { children: ReactNode }) {
  const [full, setFull] = useState(false);
  const value = useMemo(() => ({ full, setFull }), [full]);
  return <FullWorkspaceContext.Provider value={value}>{children}</FullWorkspaceContext.Provider>;
}

export function useFullWorkspace() {
  return useContext(FullWorkspaceContext);
}
