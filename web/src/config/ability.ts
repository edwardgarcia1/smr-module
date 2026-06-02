import { AbilityBuilder, PureAbility } from '@casl/ability';
import type { User } from '../store/useAuthStore';

export type AppAbility = PureAbility;

export const defineAbilitiesFor = (user: User | null) => {
  const { can, build } = new AbilityBuilder<PureAbility>(PureAbility);

  if (!user) {
    return build();
  }

  // Role-based permissions
	if (user.role === 'superadmin') {
		can('manage', 'all');
	} else if (user.role === 'admin') {
		can('read', 'users');
		can('manage', 'settings');
		can('read', 'principals');
		can('read', 'prices');
		can('read', 'bundling');
		can('manage', 'min-stock');
		can('manage', 'purchase-orders');
	} else {
		// Regular user
		can('read', 'settings');
		can('read', 'principals');
		can('read', 'prices');
		can('read', 'bundling');
		can('read', 'min-stock');
		can('read', 'purchase-orders');
	}

  return build();
};
