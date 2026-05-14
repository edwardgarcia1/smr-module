// TypeScript interface for INUnit table
// Used for unit-of-measure conversion factors

export interface Unit {
	CnvFact: number;
	FromUnit: string;
	ToUnit: string;
	InvtId: string;
}

export type UnitConversion = {
	CnvFact: number;
	FromUnit: string;
	ToUnit: string;
	InvtId: string;
};
