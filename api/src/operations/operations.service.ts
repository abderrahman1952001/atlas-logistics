import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import type { User } from '../auth/auth.types.js';
import type {
  BookingStatusDto,
  CompanyStatusDto,
  CreateRequestDto,
  QuoteDto,
  ReviewDto,
} from './dto.js';

const requestSelect = `SELECT r.id,r.reference,r.customer_company_id AS "customerCompanyId",c.name AS "customerCompanyName",r.origin,r.destination,r.cargo,r.weight_kg AS "weightKg",r.pickup_date::text AS "pickupDate",r.notes,r.status,r.created_at AS "createdAt" FROM requests r JOIN companies c ON c.id=r.customer_company_id`;
const quoteSelect = `SELECT q.id,q.request_id AS "requestId",q.provider_company_id AS "providerCompanyId",c.name AS "providerCompanyName",q.amount_dzd AS "amountDzd",q.estimated_days AS "estimatedDays",q.valid_until::text AS "validUntil",q.notes,q.status,q.created_at AS "createdAt" FROM quotes q JOIN companies c ON c.id=q.provider_company_id`;
const bookingSelect = `SELECT b.id,b.reference,b.request_id AS "requestId",b.customer_company_id AS "customerCompanyId",cc.name AS "customerCompanyName",b.provider_company_id AS "providerCompanyId",pc.name AS "providerCompanyName",r.origin,r.destination,r.cargo,b.amount_dzd AS "amountDzd",b.status,b.version,b.created_at AS "createdAt",CASE WHEN rev.id IS NULL THEN NULL ELSE json_build_object('id',rev.id,'bookingId',rev.booking_id,'rating',rev.rating,'comment',rev.comment,'createdAt',rev.created_at) END AS review FROM bookings b JOIN requests r ON r.id=b.request_id JOIN companies cc ON cc.id=b.customer_company_id JOIN companies pc ON pc.id=b.provider_company_id LEFT JOIN reviews rev ON rev.booking_id=b.id`;
const companySelect = `SELECT c.id,c.name,c.kind,c.status,c.city,c.created_at AS "createdAt" FROM companies c`;
const role = (user: User, ...roles: User['role'][]) => {
  if (!roles.includes(user.role))
    throw new ForbiddenException('Your role cannot perform this action.');
};
const clean = (v: string) => v.trim();
const today = () => new Date().toISOString().slice(0, 10);
const date = (value: string, label: string) => {
  const parsed = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
    throw new BadRequestException(`${label} must be a valid calendar date.`);
  if (value < today()) throw new BadRequestException(`${label} cannot be in the past.`);
  if (parsed.getTime() > Date.now() + 366 * 86400000)
    throw new BadRequestException(`${label} must be within the next year.`);
};
const reference = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;

@Injectable()
export class OperationsService {
  constructor(private readonly db: DatabaseService) {}
  private async verified(user: User, client?: PoolClient) {
    if (!user.companyId) throw new ForbiddenException('A company membership is required.');
    const sql = 'SELECT status,kind FROM companies WHERE id=$1' + (client ? ' FOR SHARE' : '');
    const rows = client
      ? (await client.query(sql, [user.companyId])).rows
      : await this.db.query(sql, [user.companyId]);
    if (!rows.length || rows[0].status !== 'verified' || rows[0].kind !== user.role)
      throw new ForbiddenException(
        'Your company must be verified and active to perform this action.',
      );
  }
  private async audit(
    client: PoolClient,
    user: User,
    action: string,
    type: string,
    id: string,
    detail: string,
  ) {
    await client.query(
      'INSERT INTO audit_events(id,actor_id,company_id,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), user.id, user.companyId, action, type, id, detail.slice(0, 1000)],
    );
  }
  private async notify(client: PoolClient, companyId: string, title: string, body: string) {
    await client.query(
      'INSERT INTO notifications(id,user_id,title,body) SELECT gen_random_uuid(),id,$2,$3 FROM users WHERE company_id=$1 AND active=true',
      [companyId, title, body.slice(0, 1000)],
    );
  }
  async companies(user: User) {
    return this.db.query(
      companySelect +
        (user.role === 'admin'
          ? ''
          : " WHERE c.id=$1 OR (c.kind='provider' AND c.status='verified')") +
        ' ORDER BY c.name LIMIT 200',
      user.role === 'admin' ? [] : [user.companyId],
    );
  }
  async companyStatus(user: User, id: string, data: CompanyStatusDto) {
    role(user, 'admin');
    if (clean(data.reason).length < 3) throw new BadRequestException('Give a meaningful reason.');
    return this.db.transaction(async (client) => {
      const company = (
        await client.query('SELECT id,status,name FROM companies WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (!company) throw new NotFoundException('Company not found.');
      if (company.status === data.status)
        throw new ConflictException('The company already has that status.');
      await client.query('UPDATE companies SET status=$2 WHERE id=$1', [id, data.status]);
      await this.audit(
        client,
        user,
        'company.' + data.status,
        'company',
        id,
        `${company.name}: ${clean(data.reason)}`,
      );
      await this.notify(
        client,
        id,
        'Company status updated',
        `Your company is now ${data.status}. ${clean(data.reason)}`,
      );
      return (await client.query(companySelect + ' WHERE c.id=$1', [id])).rows[0];
    });
  }
  async requests(user: User) {
    let clause = '';
    const values: unknown[] = [];
    if (user.role === 'customer') {
      clause = ' WHERE r.customer_company_id=$1';
      values.push(user.companyId);
    }
    if (user.role === 'provider') {
      const c = await this.db.query('SELECT status FROM companies WHERE id=$1', [user.companyId]);
      if (c[0]?.status !== 'verified') return [];
      clause =
        " WHERE (r.status='open' OR EXISTS(SELECT 1 FROM quotes q WHERE q.request_id=r.id AND q.provider_company_id=$1))";
      values.push(user.companyId);
    }
    return this.db.query(
      requestSelect + clause + ' ORDER BY r.created_at DESC,r.id LIMIT 200',
      values,
    );
  }
  async request(user: User, id: string) {
    const row = (await this.db.query(requestSelect + ' WHERE r.id=$1', [id]))[0];
    if (!row) throw new NotFoundException('Request not found.');
    if (user.role === 'customer' && row.customerCompanyId !== user.companyId)
      throw new NotFoundException('Request not found.');
    if (user.role === 'provider') {
      await this.verified(user);
      if (row.status !== 'open') {
        const own = await this.db.query(
          'SELECT id FROM quotes WHERE request_id=$1 AND provider_company_id=$2',
          [id, user.companyId],
        );
        if (!own.length) throw new NotFoundException('Request not found.');
      }
    }
    const quotes = await this.db.query(
      quoteSelect +
        ' WHERE q.request_id=$1' +
        (user.role === 'provider' ? ' AND q.provider_company_id=$2' : '') +
        ' ORDER BY q.created_at,q.id',
      user.role === 'provider' ? [id, user.companyId] : [id],
    );
    return { request: row, quotes };
  }
  async createRequest(user: User, data: CreateRequestDto) {
    role(user, 'customer');
    date(data.pickupDate, 'Pickup date');
    if (
      clean(data.origin).length < 2 ||
      clean(data.destination).length < 2 ||
      clean(data.cargo).length < 2
    )
      throw new BadRequestException('Origin, destination and cargo cannot be blank.');
    if (clean(data.origin).toLowerCase() === clean(data.destination).toLowerCase())
      throw new BadRequestException('Origin and destination must differ.');
    const id = randomUUID();
    await this.db.transaction(async (client) => {
      await this.verified(user, client);
      await client.query(
        'INSERT INTO requests(id,reference,customer_company_id,origin,destination,cargo,weight_kg,pickup_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          id,
          reference('AT'),
          user.companyId,
          clean(data.origin),
          clean(data.destination),
          clean(data.cargo),
          data.weightKg,
          data.pickupDate,
          clean(data.notes || ''),
        ],
      );
      await this.audit(
        client,
        user,
        'request.created',
        'request',
        id,
        `${clean(data.origin)} → ${clean(data.destination)} · ${clean(data.cargo)}`,
      );
    });
    return (await this.db.query(requestSelect + ' WHERE r.id=$1', [id]))[0];
  }
  async createQuote(user: User, id: string, data: QuoteDto) {
    role(user, 'provider');
    date(data.validUntil, 'Quote validity');
    const quoteId = randomUUID();
    await this.db.transaction(async (client) => {
      const request = (await client.query('SELECT * FROM requests WHERE id=$1 FOR UPDATE', [id]))
        .rows[0];
      if (!request) throw new NotFoundException('Request not found.');
      await this.verified(user, client);
      if (request.status !== 'open')
        throw new ConflictException('This request no longer accepts quotations.');
      if (request.pickup_date && new Date(request.pickup_date).toISOString().slice(0, 10) < today())
        throw new ConflictException('This request pickup date has passed.');
      await client.query(
        'INSERT INTO quotes(id,request_id,provider_company_id,amount_dzd,estimated_days,valid_until,notes) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          quoteId,
          id,
          user.companyId,
          data.amountDzd,
          data.estimatedDays,
          data.validUntil,
          clean(data.notes || ''),
        ],
      );
      await this.audit(
        client,
        user,
        'quote.submitted',
        'quote',
        quoteId,
        `Quotation for ${request.reference} · ${data.amountDzd} DZD`,
      );
      await this.notify(
        client,
        request.customer_company_id,
        'New quotation received',
        `${user.companyName} submitted a quotation for ${request.reference}.`,
      );
    });
    return (await this.db.query(quoteSelect + ' WHERE q.id=$1', [quoteId]))[0];
  }
  async acceptQuote(user: User, id: string) {
    role(user, 'customer');
    const bookingId = randomUUID();
    await this.db.transaction(async (client) => {
      // All contenders lock the same request first, so quote acceptance is serialized.
      const target = (await client.query('SELECT request_id FROM quotes WHERE id=$1', [id]))
        .rows[0];
      if (!target) throw new NotFoundException('Quotation not found.');
      const request = (
        await client.query('SELECT * FROM requests WHERE id=$1 FOR UPDATE', [target.request_id])
      ).rows[0];
      if (!request || request.customer_company_id !== user.companyId)
        throw new NotFoundException('Quotation not found.');
      await this.verified(user, client);
      if (request.status !== 'open')
        throw new ConflictException('A quotation was already accepted or the request was closed.');
      if (new Date(request.pickup_date).toISOString().slice(0, 10) < today())
        throw new ConflictException('This request pickup date has passed.');
      const quote = (
        await client.query(
          'SELECT *,valid_until::text AS deadline FROM quotes WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (quote.status !== 'submitted' || quote.deadline < today())
        throw new ConflictException('This quotation is expired or no longer available.');
      const provider = (
        await client.query('SELECT status FROM companies WHERE id=$1 FOR SHARE', [
          quote.provider_company_id,
        ])
      ).rows[0];
      if (provider?.status !== 'verified')
        throw new ConflictException('The provider is not currently verified.');
      await client.query(
        'INSERT INTO bookings(id,reference,request_id,quote_id,customer_company_id,provider_company_id,amount_dzd) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          bookingId,
          reference('BK'),
          request.id,
          id,
          user.companyId,
          quote.provider_company_id,
          quote.amount_dzd,
        ],
      );
      await client.query(
        "UPDATE quotes SET status=CASE WHEN id=$2 THEN 'accepted' ELSE 'rejected' END WHERE request_id=$1",
        [request.id, id],
      );
      await client.query("UPDATE requests SET status='booked' WHERE id=$1", [request.id]);
      await this.audit(
        client,
        user,
        'quote.accepted',
        'booking',
        bookingId,
        `Accepted quotation for ${request.reference} · ${quote.amount_dzd} DZD`,
      );
      await this.notify(
        client,
        quote.provider_company_id,
        'Quotation accepted',
        `Your quotation for ${request.reference} was accepted. The booking is confirmed.`,
      );
      const others = (
        await client.query(
          'SELECT provider_company_id FROM quotes WHERE request_id=$1 AND id<>$2',
          [request.id, id],
        )
      ).rows;
      for (const other of others)
        await this.notify(
          client,
          other.provider_company_id,
          'Request closed',
          `The customer selected another quotation for ${request.reference}.`,
        );
    });
    return (await this.db.query(bookingSelect + ' WHERE b.id=$1', [bookingId]))[0];
  }
  async bookings(user: User) {
    return this.db.query(
      bookingSelect +
        (user.role === 'admin'
          ? ''
          : ' WHERE (b.customer_company_id=$1 OR b.provider_company_id=$1)') +
        ' ORDER BY b.created_at DESC,b.id LIMIT 200',
      user.role === 'admin' ? [] : [user.companyId],
    );
  }
  async bookingStatus(user: User, id: string, data: BookingStatusDto) {
    return this.db.transaction(async (client) => {
      const b = (await client.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (
        !b ||
        (user.role !== 'admin' &&
          b.customer_company_id !== user.companyId &&
          b.provider_company_id !== user.companyId)
      )
        throw new NotFoundException('Booking not found.');
      if (b.version !== data.version)
        throw new ConflictException('This booking changed. Refresh before trying again.');
      const provider = user.role === 'provider' && user.companyId === b.provider_company_id;
      const customer = user.role === 'customer' && user.companyId === b.customer_company_id;
      if (data.status === 'cancelled') {
        if (b.status !== 'confirmed')
          throw new ConflictException(
            'Only a confirmed booking can be cancelled before transport starts.',
          );
        if (!data.reason || clean(data.reason).length < 3)
          throw new BadRequestException('Give a cancellation reason of at least 3 characters.');
      } else {
        if (
          !(
            (provider &&
              ((b.status === 'confirmed' && data.status === 'in_transit') ||
                (b.status === 'in_transit' && data.status === 'delivered'))) ||
            (customer && b.status === 'delivered' && data.status === 'completed')
          )
        )
          throw new ForbiddenException('Your role cannot make this status transition.');
        await this.verified(user, client);
      }
      await client.query(
        'UPDATE bookings SET status=$2,version=version+1,updated_at=now() WHERE id=$1',
        [id, data.status],
      );
      if (data.status === 'cancelled')
        await client.query("UPDATE requests SET status='cancelled' WHERE id=$1", [b.request_id]);
      await this.audit(
        client,
        user,
        'booking.' + data.status,
        'booking',
        id,
        `${b.reference}: ${b.status} → ${data.status}${data.reason ? ' · ' + clean(data.reason) : ''}`,
      );
      const recipient =
        user.companyId === b.customer_company_id ? b.provider_company_id : b.customer_company_id;
      await this.notify(
        client,
        recipient,
        'Booking status updated',
        `${b.reference} is now ${data.status.replaceAll('_', ' ')}.`,
      );
      if (user.role === 'admin')
        await this.notify(
          client,
          b.provider_company_id,
          'Booking status updated',
          `${b.reference} is now ${data.status.replaceAll('_', ' ')}.`,
        );
      return (await client.query(bookingSelect + ' WHERE b.id=$1', [id])).rows[0];
    });
  }
  async review(user: User, id: string, data: ReviewDto) {
    role(user, 'customer');
    if (!clean(data.comment)) throw new BadRequestException('A review comment is required.');
    return this.db.transaction(async (client) => {
      const b = (await client.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!b || b.customer_company_id !== user.companyId)
        throw new NotFoundException('Booking not found.');
      if (b.status !== 'completed')
        throw new ConflictException('Reviews are available after customer-confirmed completion.');
      const reviewId = randomUUID();
      const review = (
        await client.query(
          'INSERT INTO reviews(id,booking_id,author_id,rating,comment) VALUES($1,$2,$3,$4,$5) RETURNING id,booking_id AS "bookingId",rating,comment,created_at AS "createdAt"',
          [reviewId, id, user.id, data.rating, clean(data.comment)],
        )
      ).rows[0];
      await this.audit(
        client,
        user,
        'review.created',
        'review',
        reviewId,
        `Review for ${b.reference} · ${data.rating}/5`,
      );
      await this.notify(
        client,
        b.provider_company_id,
        'A customer reviewed your delivery',
        `${b.reference} received a ${data.rating}/5 review.`,
      );
      return review;
    });
  }
  async activity(user: User) {
    return this.db.query(
      `SELECT a.id,a.action,a.entity_type AS "entityType",a.entity_id AS "entityId",u.name AS "actorName",c.name AS "companyName",a.detail,a.created_at AS "createdAt" FROM audit_events a JOIN users u ON u.id=a.actor_id LEFT JOIN companies c ON c.id=a.company_id` +
        (user.role === 'admin' ? '' : ' WHERE a.company_id=$1') +
        ' ORDER BY a.created_at DESC,a.id LIMIT 100',
      user.role === 'admin' ? [] : [user.companyId],
    );
  }
  async notifications(user: User) {
    return this.db.query(
      'SELECT id,title,body,read,created_at AS "createdAt" FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,id LIMIT 100',
      [user.id],
    );
  }
  async readNotification(user: User, id: string) {
    const rows = await this.db.query(
      'UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2 RETURNING id,title,body,read,created_at AS "createdAt"',
      [id, user.id],
    );
    if (!rows.length) throw new NotFoundException('Notification not found.');
    return rows[0];
  }
  async dashboard(user: User) {
    const params = user.role === 'admin' ? [] : [user.companyId];
    const companyFilter =
      user.role === 'admin' ? '' : ' AND (b.customer_company_id=$1 OR b.provider_company_id=$1)';
    const rqFilter =
      user.role === 'admin'
        ? ''
        : user.role === 'customer'
          ? ' AND r.customer_company_id=$1'
          : " AND EXISTS(SELECT 1 FROM companies c WHERE c.id=$1 AND c.status='verified')";
    const quoteFilter =
      user.role === 'admin'
        ? ''
        : user.role === 'customer'
          ? ' AND r.customer_company_id=$1'
          : ' AND q.provider_company_id=$1';
    const [requests, quotes, bookings, activity] = await Promise.all([
      this.db.query(
        `SELECT count(*)::integer AS total FROM requests r WHERE r.status='open'${rqFilter}`,
        params,
      ),
      this.db.query(
        `SELECT count(*)::integer AS total FROM quotes q JOIN requests r ON r.id=q.request_id WHERE q.status='submitted'${quoteFilter}`,
        params,
      ),
      this.db.query(
        `SELECT count(*) FILTER(WHERE b.status IN ('confirmed','in_transit','delivered'))::integer AS active,count(*) FILTER(WHERE b.status='completed')::integer AS completed FROM bookings b WHERE true${companyFilter}`,
        params,
      ),
      this.activity(user),
    ]);
    return {
      counts: {
        openRequests: requests[0].total,
        quotes: quotes[0].total,
        activeBookings: bookings[0].active,
        completedBookings: bookings[0].completed,
      },
      recentActivity: activity.slice(0, 8),
    };
  }
}
