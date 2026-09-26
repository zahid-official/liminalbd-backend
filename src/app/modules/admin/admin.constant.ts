// Allowed sort fields for admin listing
export const ADMIN_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "name",
  "email",
  "status",
] as const;
export type AdminSortField = (typeof ADMIN_SORT_FIELDS)[number];

// Searchable text fields for admin listing
export const ADMIN_SEARCHABLE_FIELDS = ["name", "email"] as const;
export type AdminSearchableField = (typeof ADMIN_SEARCHABLE_FIELDS)[number];
