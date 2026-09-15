'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface TopBarState {
  title: string;
  subtitle?: string;
  badge?: string;
  backHref?: string;
  isAgent?: boolean;
  agentId?: string;
  isDirty?: boolean;
  isSaving?: boolean;
  onPreview?: () => void;
  onSave?: () => void;
  onVars?: () => void;
  onArchitect?: () => void;
  actions?: ReactNode;
  customLeft?: ReactNode;
}

interface TopBarContextValue extends TopBarState {
  setTopBar: (state: Partial<TopBarState>) => void;
  resetTopBar: () => void;
}

const defaults: TopBarState = {
  title: '',
  subtitle: undefined,
  badge: undefined,
  backHref: undefined,
  isAgent: false,
  agentId: undefined,
  isDirty: false,
  isSaving: false,
  onPreview: undefined,
  onSave: undefined,
  onVars: undefined,
  onArchitect: undefined,
  actions: undefined,
  customLeft: undefined,
};

const TopBarContext = createContext<TopBarContextValue>({
  ...defaults,
  setTopBar: () => {},
  resetTopBar: () => {},
});

export function TopBarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TopBarState>(defaults);

  const setTopBar = useCallback((next: Partial<TopBarState>) => {
    setState(prev => ({ ...prev, ...next }));
  }, []);

  const resetTopBar = useCallback(() => setState(defaults), []);

  return (
    <TopBarContext.Provider value={{ ...state, setTopBar, resetTopBar }}>
      {children}
    </TopBarContext.Provider>
  );
}

export function useTopBar() {
  return useContext(TopBarContext);
}
