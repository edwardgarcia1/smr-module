// TypeScript types for the Site table (Inventory Sites)
// Only SiteId and Name are exposed; full DDL lives in migrate.ts.

export interface Site {
	SiteId: string;
	Name: string;
}

export type NewSite = {
	SiteId: string;
	Name: string;
};

export type SiteUpdate = Partial<Pick<Site, "Name">>;
