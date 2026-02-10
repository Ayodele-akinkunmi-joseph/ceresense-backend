import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Define UserRole enum locally since we can't import it
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  USER = 'user',
}

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);