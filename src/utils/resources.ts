// Shared types and helpers for the resources management feature.

// Max resources one member may have borrowed at once (enforced server-side).
export const MAX_ACTIVE_BORROWS = 3;

export const COVER_BUCKET = 'resource-covers';
export const MAX_COVER_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export type ResourceStatus = 'pending' | 'active' | 'inactive';

export type ResourceCategory = {
  id: string;
  name: string;
};

// An open borrow as shown to other members: name + due date, no contact details.
export type PublicBorrow = {
  borrower_name: string;
  expected_return_date: string;
  overdue: boolean;
};

// Member-facing view of a resource (no borrower contact details).
export type ResourceListItem = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  condition: string | null;
  cover_image_url: string | null;
  category: ResourceCategory | null;
  borrow: PublicBorrow | null; // null => available
};

// True when an open borrow's expected return date is before today (date-only compare).
export function isOverdue(expectedReturnDate: string, now: Date = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(expectedReturnDate);
  return due.getTime() < today.getTime();
}
