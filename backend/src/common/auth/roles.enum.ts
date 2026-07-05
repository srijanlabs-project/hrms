// The 5 system roles from the Engineering Specification §3 (Roles & Permission Matrix).
// Tenant-level custom roles (Enterprise tier) are stored in the Role table with
// isSystemRole=false and are checked via the permissions JSONB map, not this enum.
export enum SystemRole {
  HR_ADMIN = 'HR Admin',
  MANAGER = 'Manager',
  EMPLOYEE = 'Employee',
  FINANCE = 'Finance',
  PLATFORM_ADMIN = 'Platform Admin',
}
