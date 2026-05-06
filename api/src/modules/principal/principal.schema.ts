// TypeScript types for ProductClass and Vendor tables
// ProductClass.User5 = Vendor.VendId (join key)

export interface ProductClass {
	ClassID: string;
	Descr: string;
	User5: string;
}

export type NewProductClass = {
	ClassID: string;
	Descr: string;
	User5: string;
};

export type ProductClassUpdate = Partial<Pick<ProductClass, "Descr" | "User5">>;

export interface Vendor {
	VendId: string;
	Addr1: string;
	Addr2: string;
	City: string;
	Terms: string;
}

export type NewVendor = {
	VendId: string;
	Addr1: string;
	Addr2: string;
	City: string;
	Terms: string;
};

export type VendorUpdate = Partial<
	Pick<Vendor, "Addr1" | "Addr2" | "City" | "Terms">
>;

/** Joined result of ProductClass + Vendor on User5 = VendId */
export interface ProductClassWithVendor extends ProductClass {
	VendId: string;
	VendorAddr1: string;
	VendorAddr2: string;
	VendorCity: string;
	VendorTerms: string;
}
