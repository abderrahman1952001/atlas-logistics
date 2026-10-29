# Atlas professional implementation contract

Scope: standalone Atlas only, NestJS API + PostgreSQL 17 + React TypeScript frontend + Docker Compose. Preserve existing fast live application. Synthetic demo, no invented production certification. No paid services.

API base /api, JSON. Errors {message: string|string[], statusCode:number}. Date fields ISO strings, identifiers UUID strings, money integer DZD. Server state always authoritative. Session cookie HttpOnly SameSite Strict (Secure in production), random token stored hashed. CSRF token returned by login/session and sent X-CSRF-Token for mutations. Mutations validate Origin against APP_ORIGIN if supplied. Standard accounts have real credentials and fixed roles; demo shortcuts are explicitly opt-in, never accepted in production mode.

GET /health/live, /health/ready (outside /api); GET /api/docs Swagger.
POST /api/auth/login {email,password} -> {user,csrfToken}; GET /api/auth/session -> {user,csrfToken}; POST /api/auth/logout -> 204.
user {id,name,email,role:'admin'|'customer'|'provider',companyId:string|null,companyName:string|null}.
GET /api/dashboard -> {counts:{openRequests,quotes,activeBookings,completedBookings},recentActivity: Audit[]}.
GET /api/companies -> Company[]; PATCH /api/companies/:id/status {status:'verified'|'suspended',reason:string} -> Company (admin).
Company {id,name,kind:'customer'|'provider',status:'pending'|'verified'|'suspended',city,createdAt}.
GET /api/requests -> Request[]; POST /api/requests {origin,destination,cargo,weightKg,pickupDate,notes?} -> Request.
Request {id,reference,customerCompanyId,customerCompanyName,origin,destination,cargo,weightKg,pickupDate,notes,status:'open'|'booked'|'cancelled',createdAt,quoteCount?}.
GET /api/requests/:id -> {request:Request,quotes:Quote[]}; POST /api/requests/:id/quotes {amountDzd,estimatedDays,validUntil,notes?} -> Quote (verified provider, unique per provider/request).
Quote {id,requestId,providerCompanyId,providerCompanyName,amountDzd,estimatedDays,validUntil,notes,status:'submitted'|'accepted'|'rejected',createdAt}.
POST /api/quotes/:id/accept -> Booking (request owner, transaction + unique booking per request).
GET /api/bookings -> Booking[]; PATCH /api/bookings/:id/status {status:'in_transit'|'delivered'|'completed'|'cancelled',version:number,reason?:string} -> Booking.
Booking {id,reference,requestId,customerCompanyId,customerCompanyName,providerCompanyId,providerCompanyName,origin,destination,cargo,amountDzd,status:'confirmed'|'in_transit'|'delivered'|'completed'|'cancelled',version:number,createdAt,review?:Review|null}.
Provider may confirmed→in_transit→delivered; customer may delivered→completed; customer/provider/admin can cancel confirmed only with reason. Reject stale version. Admin can inspect all, cannot masquerade as customer/provider for core workflow.
POST /api/bookings/:id/review {rating:1..5,comment} -> Review (customer owner, completed, unique).
Review {id,bookingId,rating,comment,createdAt}.
GET /api/activity -> Audit[] filtered by actor company for nonadmin; Audit {id,action,entityType,entityId,actorName,companyName,detail,createdAt}.
GET /api/notifications -> Notification[]; PATCH /api/notifications/:id/read -> Notification scoped to user/company.
Notification {id,title,body,read:boolean,createdAt}.

Demo data script: npm run seed only in DEMO_MODE=true, password in DEMO_PASSWORD env required (README local synthetic default permitted in compose). Accounts admin@atlas.example, customer@atlas.example, provider@atlas.example, competitor@atlas.example, pending@atlas.example. Two customer companies for cross-company tests (second@atlas.example). UI login may list synthetic accounts but never hard-code production credentials.

Tests use real PostgreSQL and running API via BASE_URL default http://127.0.0.1:3000. Apply migrations and seed before starting integration tests. Tests may create unique records. No SQLite substitute, no mocked database for integration claims.
