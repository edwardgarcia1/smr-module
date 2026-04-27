import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AppAbility } from './ability';
import { defineAbilitiesFor } from './ability';
import { useAuthStore } from '../store/useAuthStore';

const AbilityContext = createContext<AppAbility | undefined>(undefined);

export const AbilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore();
  const [ability, setAbility] = useState<AppAbility>(defineAbilitiesFor(null));

  useEffect(() => {
    setAbility(defineAbilitiesFor(user));
  }, [user]);

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
};

export const useAbility = () => {
  const context = useContext(AbilityContext);
  if (!context) {
    throw new Error('useAbility must be used within an AbilityProvider');
  }
  return context;
};
