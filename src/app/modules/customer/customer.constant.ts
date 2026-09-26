// Allowed sort fields for customer listing
export const CUSTOMER_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "name",
  "email",
  "status",
] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

// Searchable text fields for customer listing
export const CUSTOMER_SEARCHABLE_FIELDS = ["name", "email"] as const;
export type CustomerSearchableField =
  (typeof CUSTOMER_SEARCHABLE_FIELDS)[number];
