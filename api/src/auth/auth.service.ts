import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { randomBytes, createHash, timingSafeEqual, scrypt } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import type { User } from './auth.types.js';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const userColumns = `u.id, u.name, u.email, u.role, u.company_id AS "companyId", c.name AS "companyName"`;
export const COOKIE_NAME = 'atlas_session';
export const cookieSecure = () =>
  process.env.COOKIE_SECURE === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false');

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}
  async login(email: string, password: string, ip: string) {
    email = email.toLowerCase().trim();
    const key = hash(`account:${ip}:${email}`);
    const globalKey = hash(`ip:${ip}`);
    const globalLimit = await this.db.query(
      `INSERT INTO login_limits(key_hash,attempts,window_start) VALUES($1,1,now())
      ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE login_limits.attempts+1 END,
      window_start=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN now() ELSE login_limits.window_start END RETURNING attempts`,
      [globalKey],
    );
    if (globalLimit[0].attempts > 100)
      throw new HttpException(
        'Too many login attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const limits = await this.db.query(
      `INSERT INTO login_limits(key_hash,attempts,window_start) VALUES($1,1,now())
      ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE login_limits.attempts+1 END,
      window_start=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN now() ELSE login_limits.window_start END RETURNING attempts`,
      [key],
    );
    if (limits[0].attempts > 12)
      throw new HttpException(
        'Too many login attempts. Try again in 15 minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const rows = await this.db.query(
      `SELECT ${userColumns},u.password_hash FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.email=$1 AND u.active=true`,
      [email],
    );
    const row = rows[0];
    // Run the same expensive KDF even for unknown accounts to reduce account enumeration.
    const encoded = row?.password_hash ?? `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
    const [scheme, salt, expected] = String(encoded).split('$');
    const derived = await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        salt ?? '',
        64,
        { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
        (err, key) => (err ? reject(err) : resolve(key)),
      ),
    );
    const expectedBytes = Buffer.from(expected ?? '', 'hex');
    if (
      !row ||
      scheme !== 'scrypt' ||
      expectedBytes.length !== derived.length ||
      !timingSafeEqual(expectedBytes, derived)
    )
      throw new UnauthorizedException('Email or password is incorrect.');
    const token = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    await this.db.transaction(async (client) => {
      await client.query('DELETE FROM login_limits WHERE key_hash=$1', [key]);
      await client.query('DELETE FROM sessions WHERE expires_at <= now()');
      await client.query("DELETE FROM login_limits WHERE window_start < now()-interval '1 day'");
      await client.query(
        "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
        [hash(token), row.id, csrfToken],
      );
      // Cap active sessions per account to limit indefinite growth.
      await client.query(
        `DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions WHERE user_id=$1 ORDER BY created_at DESC OFFSET 10)`,
        [row.id],
      );
    });
    const { password_hash: _password, ...user } = row;
    return { token, csrfToken, user: user as User };
  }
  async session(token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException('Sign in to continue.');
    const sessionHash = hash(token);
    const rows = await this.db.query(
      `SELECT ${userColumns},s.csrf_token AS "csrfToken" FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN companies c ON c.id=u.company_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`,
      [sessionHash],
    );
    if (!rows.length) throw new UnauthorizedException('Your session has expired. Sign in again.');
    const { csrfToken, ...user } = rows[0];
    return { user: user as User, csrfToken: csrfToken as string, sessionHash };
  }
  async logout(sessionHash: string) {
    await this.db.query('DELETE FROM sessions WHERE token_hash=$1', [sessionHash]);
  }
}
