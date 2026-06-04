import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AppAbility } from './ability';
import { buildAbilityFromPermissions, defineAbilitiesFor } from './ability';
import type { PermissionRow } from './ability';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';

interface AbilityContextValue {
	ability: AppAbility;
	refreshAbility: () => Promise<void>;
}

const AbilityContext = createContext<AbilityContextValue | undefined>(undefined);

export const AbilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const { user } = useAuthStore();
	const [ability, setAbility] = useState<AppAbility>(defineAbilitiesFor(null));

	const refreshAbility = useCallback(async () => {
		if (!user) {
			setAbility(defineAbilitiesFor(null));
			return;
		}

		try {
			const permissions = await api.apiRequest<PermissionRow[]>(
				`/users/${user.id}/permissions`,
				{ method: 'GET' },
			);
			setAbility(buildAbilityFromPermissions(permissions));
		} catch {
			// Fall back to role-based abilities if backend unreachable
			setAbility(defineAbilitiesFor(user));
		}
	}, [user]);

	useEffect(() => {
		refreshAbility();
	}, [refreshAbility]);

	return (
		<AbilityContext.Provider value={{ ability, refreshAbility }}>
			{children}
		</AbilityContext.Provider>
	);
};

export const useAbility = () => {
	const context = useContext(AbilityContext);
	if (!context) {
		throw new Error('useAbility must be used within an AbilityProvider');
	}
	return context;
};
