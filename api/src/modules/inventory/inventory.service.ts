import { withDb } from "../../config/db";
import { BadRequestError, NotFoundError } from "../../middlewares/error";
import { trimStrings } from "../../utils/trimStrings";
import type { Site, NewSite, SiteUpdate } from "./inventory.schema";

export const createSite = async (site: NewSite): Promise<Site> => {
	const result = await withDb((pool) =>
		pool
			.request()
			.input("SiteId", site.SiteId)
			.input("Name", site.Name).query(`
        INSERT INTO Site (SiteId, Name)
        OUTPUT INSERTED.SiteId, INSERTED.Name
        VALUES (@SiteId, @Name)
      `),
	);

	const created = result.recordset[0];
	if (!created) {
		throw new Error("Failed to create site");
	}
	return trimStrings(created as Site);
};

export const getSiteById = async (
	siteId: string,
): Promise<Site | undefined> => {
	const result = await withDb((pool) =>
		pool
			.request()
			.input("SiteId", siteId)
			.query("SELECT SiteId, Name FROM Site WHERE SiteId = @SiteId"),
	);

	return trimStrings(result.recordset[0] as Site | undefined);
};

export const getAllSites = async (): Promise<Site[]> => {
	const result = await withDb((pool) =>
		pool.request().query("SELECT SiteId, Name FROM Site"),
	);
	return trimStrings(result.recordset as Site[]);
};

export const updateSite = async (
	siteId: string,
	updates: SiteUpdate,
): Promise<Site> => {
	if (!updates.Name) {
		throw new BadRequestError("Name is required for update");
	}

	const result = await withDb((pool) =>
		pool
			.request()
			.input("SiteId", siteId)
			.input("Name", updates.Name).query(`
        UPDATE Site
        SET Name = @Name
        OUTPUT INSERTED.SiteId, INSERTED.Name
        WHERE SiteId = @SiteId
      `),
	);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`Site ${siteId} not found`);
	}

	return trimStrings(result.recordset[0] as Site);
};

export const deleteSite = async (siteId: string): Promise<void> => {
	const result = await withDb((pool) =>
		pool
			.request()
			.input("SiteId", siteId)
			.query("DELETE FROM Site OUTPUT DELETED.SiteId WHERE SiteId = @SiteId"),
	);

	if (result.rowsAffected[0] === 0) {
		throw new NotFoundError(`Site ${siteId} not found`);
	}
};
