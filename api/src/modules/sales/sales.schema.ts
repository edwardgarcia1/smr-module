// Types for Sales module (heavy-reporting query)

/** A single date-range filter */
export interface DateRange {
	start: string; // ISO date, e.g. "2026-01-01"
	end: string; // ISO date, e.g. "2026-02-26"
}

/** Optional filters for sales query */
export interface SalesFilter {
	siteID?: string;
	priceClassID?: string;
	classID?: string;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

/** Transformed sales record returned by the API */
export interface SalesRecord {
	shipperID: string;
	ordNbr: string;
	ordDate: string;
	deliveryDate: string;
	invcNbr: string;
	prodMgrID: string;
	classID: string;
	classDescr: string;
	custID: string;
	shiptoID: string;
	billName: string;
	shipName: string;
	poNumber: string;
	invtID: string;
	descr: string;
	qtyOrd: number;
	qtyShip: number;
	slsPrice: number;
	chainDisc: string;
	discPct: number;
	discAmt: number;
	gross: number;
	totInvc: number;
	cnvFact: number;
	unitDesc: string;
	billAddr1: string;
	billAddr2: string;
	billCity: string;
	shipAddr1: string;
	shipAddr2: string;
	shipCity: string;
	docDate: string;
	soTypeID: string;
	siteID: string;
	company: string;
	custClassID: string;
	slsShipToID: string;
	kob: string;
	lineRef: string;
	priceClassID: string;
	slsperID: string;
	reasonCode: string;
	shipViaID: string;
	reasonDescr: string;
	subClassDescr: string;
	inBatNbr: string;
	totCost: number;
	cost: number;
	unservedQty: number;
	unservedAmt: number;
	sprNo: string;
	province: string;
	division: string;
	otd: number;
	soDate: string;
	item1: string;
	item2: string;
	item3: string;
	item4: string;
	item5: string;
}
