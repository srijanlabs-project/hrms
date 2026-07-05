export interface RequestUser {
  userId: string;
  tenantId: string | null;
  roleId: string;
  roleName: string;
  employeeId: string | null;
}

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}
