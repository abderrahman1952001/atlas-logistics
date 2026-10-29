export type Role = 'admin' | 'customer' | 'provider';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId: string | null;
  companyName: string | null;
}
export interface Company {
  id: string;
  name: string;
  kind: 'customer' | 'provider';
  status: 'pending' | 'verified' | 'suspended';
  city: string;
  createdAt: string;
}
export interface ShipmentRequest {
  id: string;
  reference: string;
  customerCompanyId: string;
  customerCompanyName: string;
  origin: string;
  destination: string;
  cargo: string;
  weightKg: number;
  pickupDate: string;
  notes: string;
  status: 'open' | 'booked' | 'cancelled';
  createdAt: string;
  quoteCount?: number;
}
export interface Quote {
  id: string;
  requestId: string;
  providerCompanyId: string;
  providerCompanyName: string;
  amountDzd: number;
  estimatedDays: number;
  validUntil: string;
  notes: string;
  status: 'submitted' | 'accepted' | 'rejected';
  createdAt: string;
}
export interface Review {
  id: string;
  bookingId: string;
  rating: number;
  comment: string;
  createdAt: string;
}
export interface Booking {
  id: string;
  reference: string;
  requestId: string;
  customerCompanyId: string;
  customerCompanyName: string;
  providerCompanyId: string;
  providerCompanyName: string;
  origin: string;
  destination: string;
  cargo: string;
  amountDzd: number;
  status: 'confirmed' | 'in_transit' | 'delivered' | 'completed' | 'cancelled';
  version: number;
  createdAt: string;
  review?: Review | null;
}
export interface Audit {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string;
  companyName: string;
  detail: string;
  createdAt: string;
}
export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}
export interface Dashboard {
  counts: {
    openRequests: number;
    quotes: number;
    activeBookings: number;
    completedBookings: number;
  };
  recentActivity: Audit[];
}
export interface WorkspaceData {
  dashboard: Dashboard;
  companies: Company[];
  requests: ShipmentRequest[];
  bookings: Booking[];
  activity: Audit[];
  notifications: Notification[];
}
export type View = 'overview' | 'requests' | 'bookings' | 'companies' | 'activity';
