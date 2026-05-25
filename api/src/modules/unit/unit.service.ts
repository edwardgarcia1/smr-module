import { withDb } from "../../config/db";
import { trimStrings } from "../../utils/trimStrings";
import type { Unit } from "./unit.schema";

/** Retrieve all unit conversion records from INUnit */
export const getAllUnits = async (): Promise<Unit[]> => {
	const result = await withDb((pool) => pool.request().query(`
		SELECT CnvFact, FromUnit, ToUnit, InvtId
		FROM INUnit
	`));
	return trimStrings(result.recordset as Unit[]);
};

/** Retrieve unit conversions filtered by InvtId */
export const getUnitsByInvtId = async (
	invtId: string,
): Promise<Unit[]> => {
	const result = await withDb((pool) =>
		pool
			.request()
			.input("InvtId", invtId)
			.query(`
			SELECT CnvFact, FromUnit, ToUnit, InvtId
			FROM INUnit
			WHERE InvtId = @InvtId
		`),
	);
	return trimStrings(result.recordset as Unit[]);
};
