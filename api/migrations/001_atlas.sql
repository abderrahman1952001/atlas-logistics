CREATE TABLE companies (
 id uuid PRIMARY KEY,
 name varchar(160) NOT NULL CHECK (length(trim(name)) > 0),
 kind varchar(16) NOT NULL CHECK (kind IN ('customer','provider')),
 status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','suspended')),
 city varchar(100) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
 id uuid PRIMARY KEY,
 company_id uuid REFERENCES companies(id),
 name varchar(120) NOT NULL,
 email varchar(254) NOT NULL UNIQUE CHECK (email = lower(email)),
 password_hash text NOT NULL,
 role varchar(16) NOT NULL CHECK (role IN ('admin','customer','provider')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((role = 'admin' AND company_id IS NULL) OR (role <> 'admin' AND company_id IS NOT NULL))
);
CREATE INDEX users_company_idx ON users(company_id);
CREATE TABLE sessions (
 token_hash char(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf_token varchar(64) NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE login_limits (
 key_hash char(64) PRIMARY KEY,
 attempts integer NOT NULL DEFAULT 1,
 window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE requests (
 id uuid PRIMARY KEY,
 reference varchar(30) NOT NULL UNIQUE,
 customer_company_id uuid NOT NULL REFERENCES companies(id),
 origin varchar(120) NOT NULL,
 destination varchar(120) NOT NULL,
 cargo varchar(200) NOT NULL,
 weight_kg integer NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 1000000),
 pickup_date date NOT NULL,
 notes varchar(2000) NOT NULL DEFAULT '',
 status varchar(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open','booked','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (lower(trim(origin)) <> lower(trim(destination))),
 CHECK (length(trim(cargo)) > 0)
);
CREATE INDEX requests_customer_idx ON requests(customer_company_id, created_at DESC);
CREATE INDEX requests_marketplace_idx ON requests(status, pickup_date);
CREATE TABLE quotes (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES requests(id),
 provider_company_id uuid NOT NULL REFERENCES companies(id),
 amount_dzd integer NOT NULL CHECK (amount_dzd BETWEEN 1 AND 1000000000),
 estimated_days integer NOT NULL CHECK (estimated_days BETWEEN 1 AND 365),
 valid_until date NOT NULL,
 notes varchar(2000) NOT NULL DEFAULT '',
 status varchar(16) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(request_id,provider_company_id),
 UNIQUE(id,request_id,provider_company_id)
);
CREATE INDEX quotes_provider_idx ON quotes(provider_company_id, created_at DESC);
CREATE UNIQUE INDEX quotes_one_accepted_idx ON quotes(request_id) WHERE status='accepted';
CREATE TABLE bookings (
 id uuid PRIMARY KEY,
 reference varchar(30) NOT NULL UNIQUE,
 request_id uuid NOT NULL UNIQUE REFERENCES requests(id),
 quote_id uuid NOT NULL UNIQUE,
 customer_company_id uuid NOT NULL REFERENCES companies(id),
 provider_company_id uuid NOT NULL REFERENCES companies(id),
 amount_dzd integer NOT NULL CHECK (amount_dzd BETWEEN 1 AND 1000000000),
 status varchar(16) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','in_transit','delivered','completed','cancelled')),
 version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(quote_id,request_id,provider_company_id) REFERENCES quotes(id,request_id,provider_company_id),
 CHECK (customer_company_id <> provider_company_id)
);
CREATE INDEX bookings_customer_idx ON bookings(customer_company_id, created_at DESC);
CREATE INDEX bookings_provider_idx ON bookings(provider_company_id, created_at DESC);
CREATE TABLE reviews (
 id uuid PRIMARY KEY,
 booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
 author_id uuid NOT NULL REFERENCES users(id),
 rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment varchar(1000) NOT NULL CHECK(length(trim(comment)) > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES users(id),
 company_id uuid REFERENCES companies(id),
 action varchar(100) NOT NULL,
 entity_type varchar(50) NOT NULL,
 entity_id uuid NOT NULL,
 detail varchar(1000) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_company_idx ON audit_events(company_id, created_at DESC);
CREATE INDEX audit_created_idx ON audit_events(created_at DESC);
CREATE TABLE notifications (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title varchar(160) NOT NULL,
 body varchar(1000) NOT NULL,
 read boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id,created_at DESC);
