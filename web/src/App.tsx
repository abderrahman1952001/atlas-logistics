import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  FileText,
  Globe2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Star,
  Truck,
  Users,
  X,
  XCircle,
  AlertCircle,
  Loader2,
  Activity as ActivityIcon,
  LockKeyhole,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api, ApiError, setCsrf } from './api';
import type {
  Audit,
  Booking,
  Company,
  Dashboard,
  Notification,
  Quote,
  ShipmentRequest,
  User,
  View,
  WorkspaceData,
} from './types';

type Translate = (en: string, ar: string) => string;
type ModalState =
  | { type: 'request' }
  | { type: 'quote'; request: ShipmentRequest }
  | { type: 'accept'; quote: Quote; request: ShipmentRequest }
  | { type: 'transition'; booking: Booking; status: Booking['status'] }
  | { type: 'cancel'; booking: Booking }
  | { type: 'review'; booking: Booking }
  | { type: 'company'; company: Company; status: 'verified' | 'suspended' };
const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
const statuses: Record<string, [string, string]> = {
  open: ['Open', 'مفتوح'],
  booked: ['Booked', 'محجوز'],
  submitted: ['Submitted', 'مقدم'],
  accepted: ['Accepted', 'مقبول'],
  rejected: ['Not selected', 'غير مختار'],
  confirmed: ['Confirmed', 'مؤكد'],
  in_transit: ['In transit', 'قيد النقل'],
  delivered: ['Delivered', 'تم التسليم'],
  completed: ['Completed', 'مكتمل'],
  cancelled: ['Cancelled', 'ملغى'],
  pending: ['Pending review', 'قيد المراجعة'],
  verified: ['Verified', 'موثق'],
  suspended: ['Suspended', 'موقوف'],
  admin: ['Administrator', 'الإدارة'],
  customer: ['Customer', 'العميل'],
  provider: ['Transport provider', 'شركة النقل'],
};
function isExpired(value: string) {
  return value.slice(0, 10) < new Date().toISOString().slice(0, 10);
}
function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`brand ${dark ? 'brand-dark' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 30 30">
          <path d="M4 25 15 5l11 20h-7l-4-8-4 8z" fill="currentColor" />
        </svg>
      </span>
      <span>
        atlas<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
function Status({ value, t }: { value: string; t: Translate }) {
  const label = statuses[value];
  return (
    <span className={`status status-${value}`}>
      <span aria-hidden="true" />
      {label ? t(...label) : value.replaceAll('_', ' ')}
    </span>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon || <Package size={24} />}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Loading({ text }: { text: string }) {
  return (
    <div className="loading-state" role="status">
      <Loader2 size={24} className="spin" />
      <span>{text}</span>
    </div>
  );
}
function Modal({
  title,
  subtitle,
  children,
  onClose,
  busy,
  t,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
  t: Translate;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      className="modal"
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) {
          const rect = ref.current.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id="modal-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={t('Close dialog', 'إغلاق النافذة')}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function Login({
  onLogin,
  lang,
  setLang,
  t,
}: {
  onLogin: (user: User) => Promise<void>;
  lang: string;
  setLang: (lang: string) => void;
  t: Translate;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api<{ user: User; csrfToken: string }>('/auth/login', {
        body: { email: email.trim(), password },
      });
      setCsrf(data.csrfToken);
      setPassword('');
      await onLogin(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Unable to sign in.', 'تعذر تسجيل الدخول.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <section className="login-story">
        <Brand />
        <div className="login-story-main">
          <span className="eyebrow light">
            <span className="live-dot" />
            {t('ONE CONNECTED OPERATION', 'عمليات مترابطة')}
          </span>
          <h1>
            {t('Every shipment.', 'كل شحنة.')}
            <br />
            {t('Moving forward.', 'خطوة إلى الأمام.')}
          </h1>
          <p>
            {t(
              'Bring your customers, transport partners and operations team into one clear workflow.',
              'اجمع العملاء وشركاء النقل وفريق العمليات في مسار عمل واحد وواضح.',
            )}
          </p>
          <div className="route-illustration" aria-hidden="true">
            <div className="illustration-top">
              <span>
                <span className="live-dot" /> ATLAS NETWORK
              </span>
              <span>01 — 03</span>
            </div>
            <svg viewBox="0 0 460 190" fill="none">
              <path
                d="M44 134 C125 134 91 49 187 49 S284 142 399 57"
                stroke="#294a50"
                strokeWidth="40"
              />
              <path
                d="M44 134 C125 134 91 49 187 49 S284 142 399 57"
                stroke="#5bbca6"
                strokeWidth="2"
                strokeDasharray="5 8"
              />
              <circle cx="44" cy="134" r="16" fill="#183b40" stroke="#6fdbc2" />
              <circle cx="44" cy="134" r="5" fill="#6fdbc2" />
              <circle cx="231" cy="62" r="20" fill="#d7f8ec" />
              <path d="m223 62 5 5 10-11" stroke="#153b34" strokeWidth="2.5" />
              <circle cx="399" cy="57" r="16" fill="#183b40" stroke="#6fdbc2" />
              <circle cx="399" cy="57" r="5" fill="#6fdbc2" />
            </svg>
            <div className="illustration-labels">
              <span>
                <b>{t('Request', 'طلب')}</b>
                {t('Define the journey', 'حدد المسار')}
              </span>
              <span>
                <b>{t('Book', 'حجز')}</b>
                {t('Choose your partner', 'اختر شريكك')}
              </span>
              <span>
                <b>{t('Deliver', 'تسليم')}</b>
                {t('Close the loop', 'أكمل الرحلة')}
              </span>
            </div>
          </div>
        </div>
        <div className="login-story-footer">
          <span>{t('Built by Cadrien Studio', 'من تطوير Cadrien Studio')}</span>
          <span>{t('Clarity at every step.', 'وضوح في كل خطوة.')}</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-top">
          <span className="login-mobile-brand">
            <Brand dark />
          </span>
          <button className="language-button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
            <Globe2 size={16} />
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>
        <div className="login-form-wrap">
          <span className="section-kicker">
            {t('YOUR OPERATIONS WORKSPACE', 'مساحة العمليات الخاصة بك')}
          </span>
          <h2>{t('Welcome back', 'مرحبًا بعودتك')}</h2>
          <p className="login-intro">
            {t('Sign in to manage your next move.', 'سجّل الدخول لإدارة عملياتك القادمة.')}
          </p>
          <form onSubmit={submit}>
            {error && (
              <div className="form-error" role="alert">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
            <label className="field">
              <span>{t('Work email', 'البريد المهني')}</span>
              <input
                type="email"
                autoComplete="username"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                dir="ltr"
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>{t('Password', 'كلمة المرور')}</span>
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t('Enter your password', 'أدخل كلمة المرور')}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? t('Hide password', 'إخفاء كلمة المرور')
                      : t('Show password', 'إظهار كلمة المرور')
                  }
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button className="button primary login-submit" disabled={busy}>
              {busy ? <Loader2 size={17} className="spin" /> : <LockKeyhole size={17} />}{' '}
              {busy
                ? t('Signing in…', 'جارٍ تسجيل الدخول…')
                : t('Sign in to Atlas', 'تسجيل الدخول إلى أطلس')}
              <ArrowRight size={17} className="button-arrow" />
            </button>
          </form>
          <div className="secure-note">
            <ShieldCheck size={16} />
            {t('Company access is assigned to your account.', 'صلاحيات الشركة مرتبطة بحسابك.')}
          </div>
          {isDemo && (
            <section className="demo-login">
              <div className="demo-login-heading">
                <span className="demo-tag">{t('DEMO', 'تجريبي')}</span>
                <span>{t('Explore a company role', 'استكشف دورًا')}</span>
              </div>
              <div className="demo-accounts">
                {[
                  {
                    email: 'customer@atlas.example',
                    en: 'Customer',
                    ar: 'العميل',
                    icon: <Package size={16} />,
                  },
                  {
                    email: 'provider@atlas.example',
                    en: 'Transport partner',
                    ar: 'شركة النقل',
                    icon: <Truck size={16} />,
                  },
                  {
                    email: 'admin@atlas.example',
                    en: 'Administrator',
                    ar: 'الإدارة',
                    icon: <ShieldCheck size={16} />,
                  },
                ].map((account) => (
                  <button
                    key={account.email}
                    className={email === account.email ? 'selected' : ''}
                    type="button"
                    onClick={() => setEmail(account.email)}
                    disabled={busy}
                  >
                    {account.icon}
                    {t(account.en, account.ar)}
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
              <p>
                {t(
                  'Synthetic data only. Use the demo password provided in the project setup. No real shipments or payments.',
                  'بيانات اصطناعية فقط. استخدم كلمة المرور التجريبية الواردة في تعليمات الإعداد. لا شحنات أو مدفوعات حقيقية.',
                )}
              </p>
            </section>
          )}
        </div>
        <footer className="login-footer">
          <span>© {new Date().getFullYear()} Atlas Operations</span>
          <a href="https://cadrienstudio.com" target="_blank" rel="noreferrer">
            Cadrien Studio <ArrowUpRight size={13} />
          </a>
        </footer>
      </section>
    </main>
  );
}

export default function App() {
  const [lang, setLangState] = useState(() =>
    localStorage.getItem('atlas-language') === 'ar' ? 'ar' : 'en',
  );
  const t: Translate = (en, ar) => (lang === 'ar' ? ar : en);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [view, setView] = useState<View>('overview');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<{
    request: ShipmentRequest;
    quotes: Quote[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [success, setSuccess] = useState('');
  const version = useRef(0);
  const detailVersion = useRef(0);
  const notificationRef = useRef<HTMLDivElement>(null);
  const locale = lang === 'ar' ? 'ar-DZ' : 'en-GB';
  const money = (amount: number) =>
    `${new Intl.NumberFormat(locale).format(amount)} ${t('DZD', 'دج')}`;
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const date = (value: string, withTime = false) => {
    if (!value) return '—';
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
    return Number.isNaN(d.valueOf())
      ? value
      : new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          ...(withTime
            ? ({ hour: '2-digit', minute: '2-digit' } as const)
            : ({ year: 'numeric' } as const)),
        }).format(d);
  };
  function setLang(value: string) {
    setLangState(value);
    localStorage.setItem('atlas-language', value);
  }
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  useEffect(() => {
    const controller = new AbortController();
    api<{ user: User; csrfToken: string }>('/auth/session', { signal: controller.signal })
      .then((result) => {
        setCsrf(result.csrfToken);
        setUser(result.user);
      })
      .catch((e) => {
        if (
          !(e instanceof DOMException && e.name === 'AbortError') &&
          !(e instanceof ApiError && e.status === 401)
        )
          setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSessionLoading(false);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (user) void refresh();
  }, [user?.id]);
  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(''), 6000);
    return () => clearTimeout(timeout);
  }, [success]);
  useEffect(() => {
    if (!notificationsOpen) return;
    const handler = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [notificationsOpen]);
  async function refresh() {
    const requestVersion = ++version.current;
    setDataLoading(true);
    try {
      const [dashboard, companies, requests, bookings, activity, notifications] = await Promise.all(
        [
          api<Dashboard>('/dashboard'),
          api<Company[]>('/companies'),
          api<ShipmentRequest[]>('/requests'),
          api<Booking[]>('/bookings'),
          api<Audit[]>('/activity'),
          api<Notification[]>('/notifications'),
        ],
      );
      if (requestVersion === version.current) {
        setData({ dashboard, companies, requests, bookings, activity, notifications });
        setError('');
      }
    } catch (e) {
      if (requestVersion !== version.current) return;
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setData(null);
        setCsrf('');
        setError(
          t('Your session ended. Please sign in again.', 'انتهت الجلسة. يرجى تسجيل الدخول مجددًا.'),
        );
      } else
        setError(
          e instanceof Error
            ? e.message
            : t('Unable to load the workspace.', 'تعذر تحميل مساحة العمل.'),
        );
    } finally {
      if (requestVersion === version.current) setDataLoading(false);
    }
  }
  async function login(account: User) {
    setError('');
    setView('overview');
    setSelectedRequest(null);
    setSearch('');
    setStatusFilter('all');
    setUser(account);
  }
  async function logout() {
    setBusy(true);
    try {
      await api<void>('/auth/logout', { method: 'POST', body: {} });
      version.current++;
      detailVersion.current++;
      setUser(null);
      setData(null);
      setSelectedRequest(null);
      setCsrf('');
      setError('');
      setSuccess('');
      setNotificationsOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  }
  function navigate(next: View) {
    setView(next);
    setSelectedRequest(null);
    detailVersion.current++;
    setDetailLoading(false);
    setSearch('');
    setStatusFilter('all');
    setMobileMenu(false);
    setError('');
  }
  async function openRequest(request: ShipmentRequest) {
    const detailRequest = ++detailVersion.current;
    setView('requests');
    setMobileMenu(false);
    setDetailLoading(true);
    setSelectedRequest(null);
    setError('');
    try {
      const result = await api<{ request: ShipmentRequest; quotes: Quote[] }>(
        `/requests/${request.id}`,
      );
      if (detailRequest === detailVersion.current) setSelectedRequest(result);
    } catch (e) {
      if (detailRequest === detailVersion.current)
        setError(e instanceof Error ? e.message : 'Unable to open request.');
    } finally {
      if (detailRequest === detailVersion.current) setDetailLoading(false);
    }
  }
  function showModal(next: ModalState) {
    setModalError('');
    setModal(next);
  }
  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setModalError('');
    setError('');
    try {
      await action();
      setModal(null);
      setSuccess(message);
      await refresh();
      if (selectedRequest) {
        try {
          const details = await api<{ request: ShipmentRequest; quotes: Quote[] }>(
            `/requests/${selectedRequest.request.id}`,
          );
          setSelectedRequest(details);
        } catch {
          setError(
            t(
              'Your change was saved, but the request details could not refresh. Reopen the request to see the latest state.',
              'تم حفظ التغيير، لكن تعذر تحديث تفاصيل الطلب. افتح الطلب مجددًا لعرض آخر حالة.',
            ),
          );
        }
      }
      return true;
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : t('The action could not be completed.', 'تعذر إتمام الإجراء.');
      if (modal) setModalError(message);
      else setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function markRead(notification: Notification) {
    if (notification.read) return;
    await act(
      () => api(`/notifications/${notification.id}/read`, { method: 'PATCH', body: {} }),
      t('Notification marked as read.', 'تم تحديد الإشعار كمقروء.'),
    );
  }
  const navItems: { view: View; en: string; ar: string; icon: ReactNode }[] = [
    { view: 'overview', en: 'Overview', ar: 'نظرة عامة', icon: <LayoutDashboard size={19} /> },
    {
      view: 'requests',
      en: 'Requests & quotes',
      ar: 'الطلبات والعروض',
      icon: <ClipboardList size={19} />,
    },
    { view: 'bookings', en: 'Bookings', ar: 'الحجوزات', icon: <Truck size={19} /> },
    { view: 'companies', en: 'Company network', ar: 'شبكة الشركات', icon: <Building2 size={19} /> },
    { view: 'activity', en: 'Activity log', ar: 'سجل النشاط', icon: <ActivityIcon size={19} /> },
  ];
  const currentNav = navItems.find((item) => item.view === view)!;
  const activeCompany = data?.companies.find((company) => company.id === user?.companyId);
  const unread = data?.notifications.filter((notification) => !notification.read).length || 0;
  const titles: Record<View, [string, string]> = {
    overview: ['Your operations, in motion.', 'عملياتك في حركة مستمرة.'],
    requests: ['Make the right connection.', 'اختر الشريك المناسب.'],
    bookings: ['Every delivery accounted for.', 'تابع كل عملية تسليم.'],
    companies: ['A network you can trust.', 'شبكة يمكنك الوثوق بها.'],
    activity: ['The full operational picture.', 'الصورة الكاملة للعمليات.'],
  };
  const subtitles: Record<View, [string, string]> = {
    overview: [
      'A clear view of your requests, partners and deliveries.',
      'صورة واضحة لطلباتك وشركائك وعمليات التسليم.',
    ],
    requests: [
      'Create transport requests, compare offers and confirm your next shipment.',
      'أنشئ طلبات النقل وقارن العروض وأكد شحنتك القادمة.',
    ],
    bookings: [
      'Follow the journey from confirmation to customer acceptance.',
      'تابع الرحلة من تأكيد الحجز إلى اعتماد العميل.',
    ],
    companies: [
      'Company status and access, in one shared directory.',
      'حالة الشركات وصلاحياتها في دليل واحد.',
    ],
    activity: [
      'Trace who did what, and when. Every record has a source.',
      'تتبع من قام بكل إجراء ووقته. لكل سجل مصدر.',
    ],
  };
  const requestMatches = (request: ShipmentRequest) =>
    (statusFilter === 'all' || request.status === statusFilter) &&
    `${request.reference} ${request.origin} ${request.destination} ${request.cargo} ${request.customerCompanyName}`
      .toLowerCase()
      .includes(search.toLowerCase());
  const bookingMatches = (booking: Booking) =>
    (statusFilter === 'all' || booking.status === statusFilter) &&
    `${booking.reference} ${booking.origin} ${booking.destination} ${booking.cargo} ${booking.providerCompanyName} ${booking.customerCompanyName}`
      .toLowerCase()
      .includes(search.toLowerCase());
  const filteredRequests = data?.requests.filter(requestMatches) || [];
  const filteredBookings = data?.bookings.filter(bookingMatches) || [];
  const filteredCompanies =
    data?.companies.filter(
      (company) =>
        (statusFilter === 'all' || company.status === statusFilter) &&
        `${company.name} ${company.city}`.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  const filteredActivity =
    data?.activity.filter((event) =>
      `${event.action} ${event.actorName} ${event.companyName} ${event.detail}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  const role = user?.role;
  const searchField = (
    <label className="search-field">
      <Search size={17} />
      <span className="sr-only">{t('Search this list', 'البحث في القائمة')}</span>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={
          view === 'companies'
            ? t('Search companies…', 'ابحث عن شركة…')
            : view === 'activity'
              ? t('Search activity…', 'ابحث في النشاط…')
              : t('Search route, cargo or reference…', 'ابحث بالمسار أو الحمولة أو المرجع…')
        }
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch('')}
          aria-label={t('Clear search', 'مسح البحث')}
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
  function activityLabel(event: Audit) {
    const labels: Record<string, [string, string]> = {
      'request.created': ['Transport request created', 'تم إنشاء طلب نقل'],
      'quote.created': ['Quotation submitted', 'تم تقديم عرض سعر'],
      'quote.submitted': ['Quotation submitted', 'تم تقديم عرض سعر'],
      'quote.accepted': ['Quotation accepted', 'تم قبول عرض السعر'],
      'booking.created': ['Booking confirmed', 'تم تأكيد الحجز'],
      'booking.confirmed': ['Booking confirmed', 'تم تأكيد الحجز'],
      'booking.in_transit': ['Shipment in transit', 'الشحنة قيد النقل'],
      'booking.delivered': ['Delivery reported', 'تم تسجيل التسليم'],
      'booking.completed': ['Delivery confirmed', 'تم تأكيد الاستلام'],
      'booking.cancelled': ['Booking cancelled', 'تم إلغاء الحجز'],
      'review.created': ['Customer review received', 'تم استلام تقييم العميل'],
      'company.verified': ['Company verified', 'تم توثيق الشركة'],
      'company.suspended': ['Company suspended', 'تم إيقاف الشركة'],
      'auth.login': ['Account signed in', 'تم تسجيل الدخول'],
    };
    return labels[event.action]
      ? t(...labels[event.action])
      : event.action.replaceAll(/[._]/g, ' ');
  }
  const requestTable = (requests: ShipmentRequest[], compact = false) => (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('SHIPMENT', 'الشحنة')}</th>
            <th>{t('ROUTE', 'المسار')}</th>
            <th>{t('PICKUP', 'الاستلام')}</th>
            {!compact && <th>{t('COMPANY', 'الشركة')}</th>}
            <th>{t('STATUS', 'الحالة')}</th>
            <th>
              <span className="sr-only">{t('Open request', 'فتح الطلب')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>
                <button className="table-link" onClick={() => void openRequest(request)}>
                  <span className="table-strong">{request.reference}</span>
                  <span>{request.cargo}</span>
                </button>
              </td>
              <td>
                <div className="route-cell">
                  <span>{request.origin}</span>
                  <ArrowRight size={13} />
                  <span>{request.destination}</span>
                </div>
                <span className="table-secondary">
                  {number(request.weightKg)} {t('kg', 'كغ')}
                </span>
              </td>
              <td className="nowrap">{date(request.pickupDate)}</td>
              {!compact && <td>{request.customerCompanyName}</td>}
              <td>
                <Status value={request.status} t={t} />
              </td>
              <td>
                <button
                  className="icon-button row-open"
                  onClick={() => void openRequest(request)}
                  aria-label={t(`Open ${request.reference}`, `فتح ${request.reference}`)}
                >
                  <ArrowUpRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (sessionLoading)
    return (
      <div className="boot-screen">
        <Brand dark />
        <Loading text={t('Connecting to your workspace…', 'جارٍ الاتصال بمساحة العمل…')} />
      </div>
    );
  if (!user)
    return (
      <>
        {error && (
          <div className="session-message" role="alert">
            {error}
            <button onClick={() => setError('')} aria-label={t('Dismiss', 'إغلاق')}>
              <X size={16} />
            </button>
          </div>
        )}
        <Login onLogin={login} lang={lang} setLang={setLang} t={t} />
      </>
    );
  return (
    <div className="app-shell" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <a className="skip-link" href="#main-content">
        {t('Skip to content', 'انتقل إلى المحتوى')}
      </a>
      {mobileMenu && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileMenu(false)}
          aria-label={t('Close navigation', 'إغلاق التنقل')}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-close icon-button"
            aria-label={t('Close navigation', 'إغلاق التنقل')}
            onClick={() => setMobileMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-icon">
            <Building2 size={17} />
          </span>
          <div>
            <strong>{user.companyName || t('Atlas administration', 'إدارة أطلس')}</strong>
            <span>{t(...statuses[user.role])}</span>
          </div>
        </div>
        <span className="sidebar-section-label">{t('WORKSPACE', 'مساحة العمل')}</span>
        <nav aria-label={t('Main navigation', 'التنقل الرئيسي')}>
          {navItems.map((item) => (
            <button
              key={item.view}
              className={`nav-item ${view === item.view ? 'active' : ''}`}
              onClick={() => navigate(item.view)}
              aria-current={view === item.view ? 'page' : undefined}
            >
              {item.icon}
              <span>{t(item.en, item.ar)}</span>
              {item.view === 'requests' && !!data?.dashboard.counts.openRequests && (
                <span className="nav-count">{data.dashboard.counts.openRequests}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={18} />
            <div>
              <strong>{t('Permission-aware by design', 'صلاحيات واضحة')}</strong>
              <p>
                {t(
                  'Your account determines what you can see and do.',
                  'يحدد حسابك ما يمكنك عرضه وتنفيذه.',
                )}
              </p>
            </div>
          </div>
          {isDemo && (
            <div className="sidebar-demo">
              <span className="live-dot" />
              {t('Demo workspace · synthetic data', 'مساحة تجريبية · بيانات اصطناعية')}
            </div>
          )}
          <div className="sidebar-user">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{t(...statuses[user.role])}</span>
            </div>
            <button
              className="icon-button"
              onClick={() => void logout()}
              disabled={busy}
              aria-label={t('Sign out', 'تسجيل الخروج')}
              title={t('Sign out', 'تسجيل الخروج')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="topbar-path">
            <button
              className="icon-button mobile-toggle"
              aria-label={t('Open navigation', 'فتح التنقل')}
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb-root">{t('Workspace', 'مساحة العمل')}</span>
            <ChevronRight size={14} />
            <strong>{t(currentNav.en, currentNav.ar)}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="language-button"
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            >
              <Globe2 size={15} />
              <span>{lang === 'ar' ? 'EN' : 'العربية'}</span>
            </button>
            <button
              className="icon-button refresh-button"
              onClick={() => void refresh()}
              disabled={dataLoading || busy}
              aria-label={t('Refresh workspace', 'تحديث مساحة العمل')}
              title={t('Refresh workspace', 'تحديث مساحة العمل')}
            >
              <RefreshCw size={18} className={dataLoading ? 'spin' : ''} />
            </button>
            <div className="notifications" ref={notificationRef}>
              <button
                className={`icon-button notification-toggle ${notificationsOpen ? 'active' : ''}`}
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                aria-expanded={notificationsOpen}
                aria-label={t(`Notifications, ${unread} unread`, `الإشعارات، ${unread} غير مقروء`)}
              >
                <Bell size={19} />
                {unread > 0 && <span className="notification-dot" />}
              </button>
              {notificationsOpen && (
                <section
                  className="notification-panel"
                  aria-label={t('Notifications', 'الإشعارات')}
                >
                  <div className="notification-head">
                    <h3>{t('Notifications', 'الإشعارات')}</h3>
                    <span className="count-label">
                      {unread} {t('new', 'جديد')}
                    </span>
                  </div>
                  <div className="notification-list">
                    {data?.notifications.length ? (
                      data.notifications.map((notification) => (
                        <div
                          className={`notification-item ${notification.read ? '' : 'unread'}`}
                          key={notification.id}
                        >
                          <span className="notification-type">
                            <Bell size={15} />
                          </span>
                          <div>
                            <h4>{notification.title}</h4>
                            <p>{notification.body}</p>
                            <time>{date(notification.createdAt, true)}</time>
                            {!notification.read && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => void markRead(notification)}
                              >
                                <Check size={13} />
                                {t('Mark read', 'تحديد كمقروء')}
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <Empty
                        icon={<Bell size={22} />}
                        title={t('All caught up', 'لا إشعارات جديدة')}
                        text={t(
                          'Updates to your requests and bookings will appear here.',
                          'ستظهر هنا تحديثات الطلبات والحجوزات.',
                        )}
                      />
                    )}
                  </div>
                </section>
              )}
            </div>
            <span className="topbar-divider" />
            <span className="avatar topbar-avatar">{initials(user.name)}</span>
          </div>
        </header>
        <main className="page-content" id="main-content">
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                <span className="section-kicker">{t('ATLAS OPERATIONS', 'أطلس للعمليات')}</span>
                <span className="heading-date">
                  {new Intl.DateTimeFormat(locale, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                  }).format(new Date())}
                </span>
              </div>
              <h1>{selectedRequest ? selectedRequest.request.reference : t(...titles[view])}</h1>
              <p>
                {selectedRequest
                  ? t('Shipment details and partner quotations.', 'تفاصيل الشحنة وعروض الشركاء.')
                  : t(...subtitles[view])}
              </p>
            </div>
            {role === 'customer' && ['overview', 'requests'].includes(view) && (
              <button
                className="button primary"
                onClick={() => showModal({ type: 'request' })}
                disabled={busy}
              >
                <Plus size={18} />
                {t('New request', 'طلب جديد')}
              </button>
            )}
          </div>
          {error && (
            <div className="notice notice-error" role="alert">
              <AlertCircle size={19} />
              <span>{error}</span>
              <button className="text-button" onClick={() => void refresh()} disabled={dataLoading}>
                {t('Retry', 'أعد المحاولة')}
              </button>
              <button
                className="icon-button"
                aria-label={t('Dismiss error', 'إغلاق الخطأ')}
                onClick={() => setError('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {success && (
            <div className="notice notice-success" role="status">
              <CheckCircle2 size={19} />
              <span>{success}</span>
              <button
                className="icon-button"
                aria-label={t('Dismiss message', 'إغلاق الرسالة')}
                onClick={() => setSuccess('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {activeCompany?.status !== 'verified' && activeCompany && (
            <div className="notice notice-warning">
              <ShieldCheck size={19} />
              <span>
                {activeCompany.status === 'pending'
                  ? t(
                      'Your company is awaiting verification. You can browse the workspace; new operational actions require approval.',
                      'شركتك بانتظار التوثيق. يمكنك استعراض المساحة؛ الإجراءات الجديدة تتطلب الاعتماد.',
                    )
                  : t(
                      'Your company is suspended. Operational actions are restricted. Contact your administrator.',
                      'شركتك موقوفة. الإجراءات التشغيلية محدودة. تواصل مع الإدارة.',
                    )}
              </span>
            </div>
          )}
          {!data ? (
            dataLoading ? (
              <div
                className="dashboard-skeleton"
                aria-label={t('Loading workspace', 'تحميل مساحة العمل')}
              >
                <div className="skeleton-stat" />
                <div className="skeleton-stat" />
                <div className="skeleton-stat" />
                <div className="skeleton-stat" />
                <div className="skeleton-table" />
              </div>
            ) : (
              <Empty
                title={t('Workspace unavailable', 'مساحة العمل غير متاحة')}
                text={t(
                  'The connection could not be completed. Your records have not changed.',
                  'تعذر الاتصال. لم تتغير سجلاتك.',
                )}
                action={
                  <button className="button primary" onClick={() => void refresh()}>
                    <RefreshCw size={16} />
                    {t('Try again', 'حاول مجددًا')}
                  </button>
                }
              />
            )
          ) : (
            <>
              {view === 'overview' && (
                <>
                  <section
                    className="stat-grid"
                    aria-label={t('Operational summary', 'ملخص العمليات')}
                  >
                    {[
                      {
                        label: t('Open requests', 'طلبات مفتوحة'),
                        value: data.dashboard.counts.openRequests,
                        icon: <ClipboardList size={20} />,
                        note: t('Ready for quotations', 'جاهزة لاستقبال العروض'),
                        tone: 'teal',
                        action: 'requests' as View,
                      },
                      {
                        label: t('Quotations', 'عروض الأسعار'),
                        value: data.dashboard.counts.quotes,
                        icon: <FileText size={20} />,
                        note: t('In your scope', 'ضمن نطاق صلاحياتك'),
                        tone: 'blue',
                        action: 'requests' as View,
                      },
                      {
                        label: t('Active bookings', 'حجوزات نشطة'),
                        value: data.dashboard.counts.activeBookings,
                        icon: <Truck size={20} />,
                        note: t('On the way to completion', 'في طريقها إلى الإتمام'),
                        tone: 'amber',
                        action: 'bookings' as View,
                      },
                      {
                        label: t('Completed', 'مكتملة'),
                        value: data.dashboard.counts.completedBookings,
                        icon: <CheckCheck size={20} />,
                        note: t('Confirmed by customers', 'مؤكدة من العملاء'),
                        tone: 'green',
                        action: 'bookings' as View,
                      },
                    ].map((stat) => (
                      <button
                        className="stat-card"
                        key={stat.label}
                        onClick={() => navigate(stat.action)}
                      >
                        <div className="stat-top">
                          <span>{stat.label}</span>
                          <span className={`stat-icon ${stat.tone}`}>{stat.icon}</span>
                        </div>
                        <strong>{number(stat.value)}</strong>
                        <div className="stat-bottom">
                          <span>{stat.note}</span>
                          <ArrowUpRight size={16} />
                        </div>
                      </button>
                    ))}
                  </section>
                  <div className="overview-grid">
                    <div className="overview-primary">
                      <section className="operation-banner">
                        <div>
                          <span className="eyebrow light">
                            {t('FROM REQUEST TO RECEIPT', 'من الطلب إلى الاستلام')}
                          </span>
                          <h2>
                            {role === 'provider'
                              ? t('Your next route starts here.', 'مسارك القادم يبدأ هنا.')
                              : role === 'admin'
                                ? t('Keep the network moving.', 'حافظ على انسياب العمليات.')
                                : t(
                                    'Good partners. Clear commitments.',
                                    'شركاء موثوقون. التزامات واضحة.',
                                  )}
                          </h2>
                          <p>
                            {role === 'provider'
                              ? t(
                                  'Find open requests, quote with confidence and manage each delivery.',
                                  'ابحث عن الطلبات المفتوحة وقدم عروضك وتابع كل عملية تسليم.',
                                )
                              : role === 'admin'
                                ? t(
                                    'Review company access and follow every operational milestone.',
                                    'راجع صلاحيات الشركات وتابع كل مرحلة تشغيلية.',
                                  )
                                : t(
                                    'Compare verified providers and move every shipment forward.',
                                    'قارن بين شركات النقل الموثقة وتابع كل شحنة.',
                                  )}
                          </p>
                          <button
                            onClick={() => navigate(role === 'admin' ? 'companies' : 'requests')}
                            className="banner-link"
                          >
                            {role === 'admin'
                              ? t('Review companies', 'مراجعة الشركات')
                              : t('Explore requests', 'استكشاف الطلبات')}
                            <ArrowRight size={17} />
                          </button>
                        </div>
                        <div className="banner-graphic" aria-hidden="true">
                          <div className="graphic-ring ring-outer" />
                          <div className="graphic-ring ring-inner" />
                          <span className="graphic-truck">
                            <Truck size={36} strokeWidth={1.4} />
                          </span>
                          <span className="graphic-node node-1">
                            <Check size={13} />
                          </span>
                          <span className="graphic-node node-2">
                            <MapPin size={13} />
                          </span>
                          <span className="graphic-node node-3" />
                        </div>
                      </section>
                      <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2>{t('Recent requests', 'أحدث الطلبات')}</h2>
                            <p>
                              {t(
                                'The latest moves across your workspace.',
                                'أحدث العمليات في مساحة عملك.',
                              )}
                            </p>
                          </div>
                          <button className="text-button" onClick={() => navigate('requests')}>
                            {t('View all', 'عرض الكل')}
                            <ArrowRight size={15} />
                          </button>
                        </div>
                        {data.requests.length ? (
                          requestTable(data.requests.slice(0, 5), true)
                        ) : (
                          <Empty
                            title={t(
                              'Your next move starts with a request',
                              'خطوتك القادمة تبدأ بطلب',
                            )}
                            text={
                              role === 'customer'
                                ? t(
                                    'Add a route, cargo details and pickup date to receive quotations.',
                                    'أضف المسار وتفاصيل الحمولة وتاريخ الاستلام لتلقي العروض.',
                                  )
                                : t(
                                    'Open transport requests will appear here.',
                                    'ستظهر طلبات النقل المفتوحة هنا.',
                                  )
                            }
                            action={
                              role === 'customer' ? (
                                <button
                                  className="button secondary"
                                  onClick={() => showModal({ type: 'request' })}
                                >
                                  <Plus size={16} />
                                  {t('Create a request', 'إنشاء طلب')}
                                </button>
                              ) : undefined
                            }
                          />
                        )}
                      </section>
                    </div>
                    <div className="overview-secondary">
                      <section className="panel activity-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>{t('Recent activity', 'أحدث النشاطات')}</h2>
                            <p>{t('A traceable chain of events.', 'سلسلة أحداث قابلة للتتبع.')}</p>
                          </div>
                          <span className="small-icon">
                            <ActivityIcon size={18} />
                          </span>
                        </div>
                        {data.dashboard.recentActivity.length ? (
                          <div className="activity-timeline">
                            {data.dashboard.recentActivity.slice(0, 5).map((event, index) => (
                              <div className="timeline-event" key={event.id}>
                                <span className={`timeline-dot ${index === 0 ? 'current' : ''}`} />
                                <div>
                                  <strong>{activityLabel(event)}</strong>
                                  <span>{event.actorName || event.companyName}</span>
                                  <time>{date(event.createdAt, true)}</time>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="activity-placeholder">
                            <Clock3 size={22} />
                            <p>
                              {t(
                                'Operational events will appear as your team works.',
                                'ستظهر الأحداث التشغيلية أثناء عمل فريقك.',
                              )}
                            </p>
                          </div>
                        )}
                        <button className="panel-footer-link" onClick={() => navigate('activity')}>
                          {t('Open activity log', 'فتح سجل النشاط')}
                          <ArrowRight size={16} />
                        </button>
                      </section>
                      <section className="scope-card">
                        <span className="scope-icon">
                          <ShieldCheck size={23} />
                        </span>
                        <h3>{t('The right access. By default.', 'الصلاحيات المناسبة دائمًا.')}</h3>
                        <p>
                          {t(
                            'You see only the records available to your role and company. Quotations stay private to the relevant parties.',
                            'تظهر لك السجلات المتاحة لدورك وشركتك فقط. تظل عروض الأسعار خاصة بالأطراف المعنية.',
                          )}
                        </p>
                        <div>
                          <span>{t('SIGNED IN AS', 'مسجل بصفة')}</span>
                          <strong>{t(...statuses[user.role])}</strong>
                        </div>
                      </section>
                    </div>
                  </div>
                </>
              )}
              {view === 'requests' && (
                <>
                  {detailLoading ? (
                    <section className="panel">
                      <Loading text={t('Loading request details…', 'جارٍ تحميل تفاصيل الطلب…')} />
                    </section>
                  ) : selectedRequest ? (
                    <>
                      <button
                        className="back-button"
                        onClick={() => {
                          setSelectedRequest(null);
                          detailVersion.current++;
                        }}
                      >
                        <ArrowDownLeft size={17} />
                        {t('All requests', 'كل الطلبات')}
                      </button>
                      <div className="request-detail-grid">
                        <section className="panel shipment-detail">
                          <div className="panel-heading">
                            <div>
                              <span className="section-kicker">
                                {t('TRANSPORT REQUEST', 'طلب نقل')}
                              </span>
                              <h2>{selectedRequest.request.cargo}</h2>
                            </div>
                            <Status value={selectedRequest.request.status} t={t} />
                          </div>
                          <div className="large-route">
                            <div>
                              <span className="route-marker origin-marker" />
                              <span className="detail-label">{t('PICKUP', 'الاستلام')}</span>
                              <strong>{selectedRequest.request.origin}</strong>
                            </div>
                            <div>
                              <span className="route-marker destination-marker" />
                              <span className="detail-label">{t('DESTINATION', 'الوجهة')}</span>
                              <strong>{selectedRequest.request.destination}</strong>
                            </div>
                          </div>
                          <dl className="detail-grid">
                            <div>
                              <dt>{t('Weight', 'الوزن')}</dt>
                              <dd>
                                {number(selectedRequest.request.weightKg)} {t('kg', 'كغ')}
                              </dd>
                            </div>
                            <div>
                              <dt>{t('Pickup date', 'تاريخ الاستلام')}</dt>
                              <dd>{date(selectedRequest.request.pickupDate)}</dd>
                            </div>
                            <div>
                              <dt>{t('Requested by', 'صاحب الطلب')}</dt>
                              <dd>{selectedRequest.request.customerCompanyName}</dd>
                            </div>
                            <div>
                              <dt>{t('Created', 'تاريخ الإنشاء')}</dt>
                              <dd>{date(selectedRequest.request.createdAt)}</dd>
                            </div>
                          </dl>
                          {selectedRequest.request.notes && (
                            <div className="shipment-notes">
                              <h3>{t('Shipment instructions', 'تعليمات الشحنة')}</h3>
                              <p>{selectedRequest.request.notes}</p>
                            </div>
                          )}
                          <div className="detail-security">
                            <LockKeyhole size={15} />
                            {t(
                              'Company permissions apply to this request and its quotations.',
                              'تنطبق صلاحيات الشركات على هذا الطلب وعروضه.',
                            )}
                          </div>
                        </section>
                        <section className="quotes-section">
                          <div className="quotes-heading">
                            <div>
                              <h2>
                                {t('Partner quotations', 'عروض الشركاء')}
                                <span className="count-label">{selectedRequest.quotes.length}</span>
                              </h2>
                              <p>
                                {role === 'provider'
                                  ? t(
                                      'Your company’s quotations for this request.',
                                      'عروض شركتك الخاصة بهذا الطلب.',
                                    )
                                  : t(
                                      'Compare the offer, timeline and delivery terms.',
                                      'قارن السعر والمدة وشروط التسليم.',
                                    )}
                              </p>
                            </div>
                            {role === 'provider' &&
                              selectedRequest.request.status === 'open' &&
                              !selectedRequest.quotes.some(
                                (quote) => quote.providerCompanyId === user.companyId,
                              ) && (
                                <button
                                  className="button primary small"
                                  disabled={activeCompany?.status !== 'verified'}
                                  onClick={() =>
                                    showModal({ type: 'quote', request: selectedRequest.request })
                                  }
                                >
                                  <Plus size={16} />
                                  {t('Submit quote', 'تقديم عرض')}
                                </button>
                              )}
                          </div>
                          {selectedRequest.quotes.length ? (
                            <div className="quote-list">
                              {[...selectedRequest.quotes]
                                .sort((a, b) => a.amountDzd - b.amountDzd)
                                .map((quote, index) => (
                                  <article
                                    className={`quote-card ${quote.status === 'accepted' ? 'accepted' : ''}`}
                                    key={quote.id}
                                  >
                                    <div className="quote-card-top">
                                      <span className="company-avatar">
                                        <Truck size={21} />
                                      </span>
                                      <div>
                                        <h3>{quote.providerCompanyName}</h3>
                                        <span>{t('Transport partner', 'شركة نقل')}</span>
                                      </div>
                                      <Status value={quote.status} t={t} />
                                    </div>
                                    <div className="quote-price-row">
                                      <strong>{money(quote.amountDzd)}</strong>
                                      {index === 0 &&
                                        selectedRequest.quotes.length > 1 &&
                                        quote.status === 'submitted' && (
                                          <span className="best-price">
                                            {t('Lowest quote', 'أقل عرض')}
                                          </span>
                                        )}
                                    </div>
                                    <div className="quote-terms">
                                      <span>
                                        <Clock3 size={15} />
                                        {quote.estimatedDays}{' '}
                                        {t(
                                          quote.estimatedDays === 1
                                            ? 'day estimated'
                                            : 'days estimated',
                                          'أيام تقديرية',
                                        )}
                                      </span>
                                      <span>
                                        {t('Valid until', 'صالح حتى')} {date(quote.validUntil)}
                                      </span>
                                    </div>
                                    {quote.notes && <p className="quote-notes">{quote.notes}</p>}
                                    {role === 'customer' &&
                                      selectedRequest.request.customerCompanyId ===
                                        user.companyId &&
                                      selectedRequest.request.status === 'open' &&
                                      quote.status === 'submitted' && (
                                        <button
                                          className="button secondary full-width"
                                          disabled={isExpired(quote.validUntil)}
                                          onClick={() =>
                                            showModal({
                                              type: 'accept',
                                              quote,
                                              request: selectedRequest.request,
                                            })
                                          }
                                        >
                                          {isExpired(quote.validUntil)
                                            ? t('Quotation expired', 'انتهت صلاحية العرض')
                                            : t('Accept quotation', 'قبول العرض')}
                                          <ArrowRight size={16} />
                                        </button>
                                      )}
                                  </article>
                                ))}
                            </div>
                          ) : (
                            <div className="panel">
                              <Empty
                                icon={<FileText size={24} />}
                                title={t('No quotations yet', 'لا عروض حتى الآن')}
                                text={
                                  role === 'provider'
                                    ? t(
                                        'Submit your price and delivery estimate to take part.',
                                        'قدم سعرك والمدة المقدرة للمشاركة.',
                                      )
                                    : t(
                                        'Verified transport partners can now submit their offers.',
                                        'يمكن الآن لشركات النقل الموثقة تقديم عروضها.',
                                      )
                                }
                              />
                            </div>
                          )}
                        </section>
                      </div>
                    </>
                  ) : (
                    <section className="panel">
                      <div className="list-toolbar">
                        <div
                          className="filter-tabs"
                          role="group"
                          aria-label={t('Filter requests', 'تصفية الطلبات')}
                        >
                          {['all', 'open', 'booked', 'cancelled'].map((status) => (
                            <button
                              key={status}
                              className={statusFilter === status ? 'selected' : ''}
                              onClick={() => setStatusFilter(status)}
                            >
                              {status === 'all'
                                ? t('All requests', 'كل الطلبات')
                                : t(...statuses[status])}
                              {status === 'all' && <span>{data.requests.length}</span>}
                            </button>
                          ))}
                        </div>
                        {searchField}
                      </div>
                      {filteredRequests.length ? (
                        requestTable(filteredRequests)
                      ) : (
                        <Empty
                          icon={<Search size={24} />}
                          title={
                            search || statusFilter !== 'all'
                              ? t('No matching requests', 'لا طلبات مطابقة')
                              : t('No requests yet', 'لا طلبات حتى الآن')
                          }
                          text={
                            search || statusFilter !== 'all'
                              ? t(
                                  'Try another search or status filter.',
                                  'جرّب بحثًا أو حالة أخرى.',
                                )
                              : t(
                                  'Requests will appear here when a customer creates a shipment.',
                                  'ستظهر الطلبات هنا عندما ينشئ العميل شحنة.',
                                )
                          }
                        />
                      )}
                      <div className="table-footer">
                        <span>
                          {t('Showing', 'عرض')} {filteredRequests.length} {t('of', 'من')}{' '}
                          {data.requests.length} {t('requests', 'طلبات')}
                        </span>
                        <span>
                          <LockKeyhole size={13} />
                          {t('Filtered by your access', 'حسب صلاحياتك')}
                        </span>
                      </div>
                    </section>
                  )}
                </>
              )}
              {view === 'bookings' && (
                <section className="panel">
                  <div className="list-toolbar">
                    <div
                      className="filter-tabs"
                      role="group"
                      aria-label={t('Filter bookings', 'تصفية الحجوزات')}
                    >
                      {[
                        'all',
                        'confirmed',
                        'in_transit',
                        'delivered',
                        'completed',
                        'cancelled',
                      ].map((status) => (
                        <button
                          key={status}
                          className={statusFilter === status ? 'selected' : ''}
                          onClick={() => setStatusFilter(status)}
                        >
                          {status === 'all' ? t('All', 'الكل') : t(...statuses[status])}
                        </button>
                      ))}
                    </div>
                    {searchField}
                  </div>
                  {filteredBookings.length ? (
                    <div className="booking-list">
                      {filteredBookings.map((booking) => (
                        <article className="booking-card" key={booking.id}>
                          <div className="booking-card-header">
                            <div>
                              <span className="booking-icon">
                                <Truck size={21} />
                              </span>
                              <div>
                                <strong>{booking.reference}</strong>
                                <span>{booking.cargo}</span>
                              </div>
                            </div>
                            <Status value={booking.status} t={t} />
                          </div>
                          <div className="booking-content">
                            <div className="booking-route">
                              <div>
                                <span className="route-small-dot" />
                                <span>{t('FROM', 'من')}</span>
                                <strong>{booking.origin}</strong>
                              </div>
                              <div>
                                <span className="route-small-dot destination" />
                                <span>{t('TO', 'إلى')}</span>
                                <strong>{booking.destination}</strong>
                              </div>
                            </div>
                            <div className="booking-parties">
                              <span>{t('TRANSPORT PARTNER', 'شركة النقل')}</span>
                              <strong>{booking.providerCompanyName}</strong>
                              <span>{t('CUSTOMER', 'العميل')}</span>
                              <strong>{booking.customerCompanyName}</strong>
                            </div>
                            <div className="booking-value">
                              <span>{t('BOOKING VALUE', 'قيمة الحجز')}</span>
                              <strong>{money(booking.amountDzd)}</strong>
                              <small>
                                {t(
                                  'Agreed quotation · no payment collected',
                                  'عرض متفق عليه · لم تُحصّل دفعة',
                                )}
                              </small>
                            </div>
                          </div>
                          {booking.status !== 'cancelled' && (
                            <div
                              className="booking-progress"
                              aria-label={t('Booking progress', 'مراحل الحجز')}
                            >
                              {['confirmed', 'in_transit', 'delivered', 'completed'].map(
                                (step, index) => (
                                  <div
                                    key={step}
                                    className={
                                      ['confirmed', 'in_transit', 'delivered', 'completed'].indexOf(
                                        booking.status,
                                      ) >= index
                                        ? 'done'
                                        : ''
                                    }
                                  >
                                    <span>
                                      {[
                                        'confirmed',
                                        'in_transit',
                                        'delivered',
                                        'completed',
                                      ].indexOf(booking.status) > index ? (
                                        <Check size={12} />
                                      ) : (
                                        index + 1
                                      )}
                                    </span>
                                    <strong>{t(...statuses[step])}</strong>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                          <div className="booking-footer">
                            <span className="booking-date">
                              <Clock3 size={14} />
                              {t('Created', 'أُنشئ')} {date(booking.createdAt)}
                            </span>
                            <div className="booking-actions">
                              {booking.status === 'confirmed' && (
                                <button
                                  className="text-button danger"
                                  onClick={() => showModal({ type: 'cancel', booking })}
                                  disabled={busy}
                                >
                                  {t('Cancel booking', 'إلغاء الحجز')}
                                </button>
                              )}
                              {role === 'provider' &&
                                booking.providerCompanyId === user.companyId &&
                                booking.status === 'confirmed' && (
                                  <button
                                    className="button primary small"
                                    onClick={() =>
                                      showModal({
                                        type: 'transition',
                                        booking,
                                        status: 'in_transit',
                                      })
                                    }
                                    disabled={busy}
                                  >
                                    <Truck size={15} />
                                    {t('Start transport', 'بدء النقل')}
                                  </button>
                                )}
                              {role === 'provider' &&
                                booking.providerCompanyId === user.companyId &&
                                booking.status === 'in_transit' && (
                                  <button
                                    className="button primary small"
                                    onClick={() =>
                                      showModal({
                                        type: 'transition',
                                        booking,
                                        status: 'delivered',
                                      })
                                    }
                                    disabled={busy}
                                  >
                                    <Check size={15} />
                                    {t('Mark delivered', 'تسجيل التسليم')}
                                  </button>
                                )}
                              {role === 'customer' &&
                                booking.customerCompanyId === user.companyId &&
                                booking.status === 'delivered' && (
                                  <button
                                    className="button primary small"
                                    onClick={() =>
                                      showModal({
                                        type: 'transition',
                                        booking,
                                        status: 'completed',
                                      })
                                    }
                                    disabled={busy}
                                  >
                                    <CheckCheck size={15} />
                                    {t('Confirm receipt', 'تأكيد الاستلام')}
                                  </button>
                                )}
                              {role === 'customer' &&
                                booking.customerCompanyId === user.companyId &&
                                booking.status === 'completed' &&
                                !booking.review && (
                                  <button
                                    className="button secondary small"
                                    onClick={() => showModal({ type: 'review', booking })}
                                  >
                                    <Star size={15} />
                                    {t('Leave a review', 'إضافة تقييم')}
                                  </button>
                                )}
                              {booking.review && (
                                <span className="review-rating">
                                  <Star size={15} fill="currentColor" />
                                  {booking.review.rating}/5{' '}
                                  <span>{t('Customer review', 'تقييم العميل')}</span>
                                </span>
                              )}
                              {booking.status === 'delivered' && role !== 'customer' && (
                                <span className="awaiting-label">
                                  {t('Awaiting customer confirmation', 'بانتظار تأكيد العميل')}
                                </span>
                              )}
                            </div>
                          </div>
                          {booking.review?.comment && (
                            <div className="booking-review">“{booking.review.comment}”</div>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<Truck size={25} />}
                      title={
                        search || statusFilter !== 'all'
                          ? t('No matching bookings', 'لا حجوزات مطابقة')
                          : t('Ready when you are', 'جاهز عند تأكيدك')
                      }
                      text={
                        search || statusFilter !== 'all'
                          ? t(
                              'Try another route, reference or status.',
                              'جرّب مسارًا أو مرجعًا أو حالة أخرى.',
                            )
                          : t(
                              'Accepting a quotation creates a booking here, with a clear delivery timeline.',
                              'يؤدي قبول عرض السعر إلى إنشاء حجز هنا، بمراحل تسليم واضحة.',
                            )
                      }
                    />
                  )}
                </section>
              )}
              {view === 'companies' && (
                <>
                  <div className="network-summary">
                    <span className="network-summary-icon">
                      <Users size={23} />
                    </span>
                    <div>
                      <strong>
                        {data.companies.filter((company) => company.status === 'verified').length}{' '}
                        {t('verified companies', 'شركات موثقة')}
                      </strong>
                      <p>
                        {role === 'admin'
                          ? t(
                              'Review pending companies before allowing operational access.',
                              'راجع الشركات المعلقة قبل منحها صلاحيات تشغيلية.',
                            )
                          : t(
                              'Verification status is managed by the operations administrator.',
                              'تتولى إدارة العمليات مراجعة حالة توثيق الشركات.',
                            )}
                      </p>
                    </div>
                    {role === 'admin' && (
                      <span className="pending-count">
                        {data.companies.filter((company) => company.status === 'pending').length}{' '}
                        {t('awaiting review', 'بانتظار المراجعة')}
                      </span>
                    )}
                  </div>
                  <section className="panel">
                    <div className="list-toolbar">
                      <div
                        className="filter-tabs"
                        role="group"
                        aria-label={t('Filter companies', 'تصفية الشركات')}
                      >
                        {['all', 'verified', 'pending', 'suspended'].map((status) => (
                          <button
                            key={status}
                            className={statusFilter === status ? 'selected' : ''}
                            onClick={() => setStatusFilter(status)}
                          >
                            {status === 'all'
                              ? t('All companies', 'كل الشركات')
                              : t(...statuses[status])}
                          </button>
                        ))}
                      </div>
                      {searchField}
                    </div>
                    {filteredCompanies.length ? (
                      <div className="company-grid">
                        {filteredCompanies.map((company) => (
                          <article className="company-card" key={company.id}>
                            <div className="company-card-head">
                              <span className={`company-letter ${company.kind}`}>
                                {initials(company.name)}
                              </span>
                              <Status value={company.status} t={t} />
                            </div>
                            <h3>
                              {company.name}
                              {company.id === user.companyId && (
                                <span className="you-tag">{t('YOU', 'شركتك')}</span>
                              )}
                            </h3>
                            <span className="company-kind">{t(...statuses[company.kind])}</span>
                            <div className="company-meta">
                              <MapPin size={15} />
                              {company.city || '—'}
                            </div>
                            <div className="company-card-footer">
                              <span>
                                {t('Joined', 'انضمت')} {date(company.createdAt)}
                              </span>
                              {role === 'admin' ? (
                                company.status === 'verified' ? (
                                  <button
                                    className="text-button danger"
                                    onClick={() =>
                                      showModal({ type: 'company', company, status: 'suspended' })
                                    }
                                  >
                                    {t('Suspend', 'إيقاف')}
                                  </button>
                                ) : (
                                  <button
                                    className="text-button"
                                    onClick={() =>
                                      showModal({ type: 'company', company, status: 'verified' })
                                    }
                                  >
                                    <ShieldCheck size={15} />
                                    {company.status === 'suspended'
                                      ? t('Reinstate', 'إعادة تفعيل')
                                      : t('Verify', 'توثيق')}
                                  </button>
                                )
                              ) : (
                                <ShieldCheck
                                  size={16}
                                  className={
                                    company.status === 'verified' ? 'text-teal' : 'text-muted'
                                  }
                                />
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        icon={<Building2 size={25} />}
                        title={t('No matching companies', 'لا شركات مطابقة')}
                        text={t(
                          'Try another company name or status.',
                          'جرّب اسم شركة أو حالة أخرى.',
                        )}
                      />
                    )}
                  </section>
                </>
              )}
              {view === 'activity' && (
                <section className="panel">
                  <div className="list-toolbar">
                    <div>
                      <h2 className="toolbar-title">
                        {t('Operational history', 'السجل التشغيلي')}
                        <span className="count-label">{data.activity.length}</span>
                      </h2>
                    </div>
                    {searchField}
                  </div>
                  {filteredActivity.length ? (
                    <div className="audit-list">
                      {filteredActivity.map((event) => (
                        <article className="audit-event" key={event.id}>
                          <span className="audit-icon">
                            {event.entityType === 'company' ? (
                              <Building2 size={19} />
                            ) : event.entityType === 'booking' ? (
                              <Truck size={19} />
                            ) : (
                              <FileText size={19} />
                            )}
                          </span>
                          <div className="audit-main">
                            <h3>{activityLabel(event)}</h3>
                            <p>{event.detail || event.action}</p>
                            <div>
                              <span className="audit-actor">
                                {event.actorName || t('System', 'النظام')}
                              </span>
                              {event.companyName && <span> · {event.companyName}</span>}
                            </div>
                          </div>
                          <div className="audit-time">
                            <time>{date(event.createdAt, true)}</time>
                            <span>{event.entityType}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<ActivityIcon size={25} />}
                      title={
                        search
                          ? t('No matching events', 'لا أحداث مطابقة')
                          : t('The story starts here', 'يبدأ السجل هنا')
                      }
                      text={
                        search
                          ? t(
                              'Try a different actor, company or action.',
                              'جرّب اسم مستخدم أو شركة أو إجراء آخر.',
                            )
                          : t(
                              'Requests, quotations and booking changes are recorded automatically.',
                              'تُسجل الطلبات والعروض وتغييرات الحجوزات تلقائيًا.',
                            )
                      }
                    />
                  )}
                  <div className="table-footer">
                    <span>{t('Events visible to your account', 'الأحداث المتاحة لحسابك')}</span>
                    <span>
                      <ShieldCheck size={13} />
                      {t('Application audit trail', 'سجل تدقيق التطبيق')}
                    </span>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              Atlas Operations <span className="footer-dot">·</span> {t('Built by', 'تطوير')}{' '}
              <a href="https://cadrienstudio.com" target="_blank" rel="noreferrer">
                Cadrien Studio
              </a>
            </span>
            <span>
              {isDemo
                ? t(
                    'Synthetic demonstration. No real transport or payments.',
                    'عرض تجريبي اصطناعي. لا نقل أو مدفوعات حقيقية.',
                  )
                : t('Every move, accounted for.', 'كل عملية قابلة للتتبع.')}
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <Modal
          title={
            modal.type === 'request'
              ? t('Create a transport request', 'إنشاء طلب نقل')
              : modal.type === 'quote'
                ? t('Submit your quotation', 'تقديم عرض السعر')
                : modal.type === 'accept'
                  ? t('Confirm this quotation', 'تأكيد عرض السعر')
                  : modal.type === 'cancel'
                    ? t('Cancel this booking', 'إلغاء هذا الحجز')
                    : modal.type === 'review'
                      ? t('Review your transport partner', 'تقييم شركة النقل')
                      : modal.type === 'company'
                        ? modal.status === 'verified'
                          ? t('Verify company access', 'توثيق صلاحيات الشركة')
                          : t('Suspend company access', 'إيقاف صلاحيات الشركة')
                        : modal.status === 'in_transit'
                          ? t('Start this shipment', 'بدء نقل الشحنة')
                          : modal.status === 'delivered'
                            ? t('Report delivery', 'تسجيل التسليم')
                            : t('Confirm your delivery', 'تأكيد الاستلام')
          }
          subtitle={
            modal.type === 'request'
              ? t(
                  'Give transport partners the details they need to quote.',
                  'قدم لشركات النقل التفاصيل اللازمة لإعداد العروض.',
                )
              : undefined
          }
          onClose={() => setModal(null)}
          busy={busy}
          t={t}
        >
          {modalError && (
            <div className="form-error modal-form-error" role="alert">
              <AlertCircle size={17} />
              {modalError}
            </div>
          )}
          {modal.type === 'request' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void act(
                  () =>
                    api('/requests', {
                      body: {
                        origin: form.get('origin'),
                        destination: form.get('destination'),
                        cargo: form.get('cargo'),
                        weightKg: Number(form.get('weightKg')),
                        pickupDate: form.get('pickupDate'),
                        notes: form.get('notes'),
                      },
                    }),
                  t(
                    'Transport request created. Partners can now submit quotations.',
                    'تم إنشاء طلب النقل. يمكن للشركاء تقديم العروض الآن.',
                  ),
                );
              }}
            >
              <div className="modal-body">
                <div className="form-grid">
                  <label className="field">
                    <span>{t('Pickup city', 'مدينة الاستلام')}</span>
                    <input
                      name="origin"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder={t('e.g. Algiers', 'مثال: الجزائر')}
                      autoFocus
                    />
                  </label>
                  <label className="field">
                    <span>{t('Destination city', 'مدينة الوجهة')}</span>
                    <input
                      name="destination"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder={t('e.g. Oran', 'مثال: وهران')}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>{t('Cargo description', 'وصف الحمولة')}</span>
                  <input
                    name="cargo"
                    required
                    minLength={2}
                    maxLength={200}
                    placeholder={t(
                      'e.g. 12 pallets of packaged supplies',
                      'مثال: 12 منصة من مستلزمات مغلفة',
                    )}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>{t('Total weight (kg)', 'الوزن الإجمالي (كغ)')}</span>
                    <input
                      name="weightKg"
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      required
                      placeholder="1200"
                    />
                  </label>
                  <label className="field">
                    <span>{t('Pickup date', 'تاريخ الاستلام')}</span>
                    <input
                      name="pickupDate"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </label>
                </div>
                <label className="field">
                  <span>
                    {t('Additional instructions', 'تعليمات إضافية')}{' '}
                    <small>{t('Optional', 'اختياري')}</small>
                  </span>
                  <textarea
                    name="notes"
                    maxLength={2000}
                    rows={3}
                    placeholder={t(
                      'Access, loading requirements or timing…',
                      'متطلبات الوصول أو التحميل أو التوقيت…',
                    )}
                  />
                </label>
                <p className="form-hint">
                  <ShieldCheck size={14} />
                  {t(
                    'This request belongs to your company. Only authorized partners can quote.',
                    'هذا الطلب تابع لشركتك. يمكن للشركاء المخولين فقط تقديم عروض.',
                  )}
                </p>
              </div>
              <FormFooter
                busy={busy}
                cancel={() => setModal(null)}
                submit={t('Create request', 'إنشاء الطلب')}
                t={t}
              />
            </form>
          )}
          {modal.type === 'quote' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void act(
                  () =>
                    api(`/requests/${modal.request.id}/quotes`, {
                      body: {
                        amountDzd: Number(form.get('amountDzd')),
                        estimatedDays: Number(form.get('estimatedDays')),
                        validUntil: form.get('validUntil'),
                        notes: form.get('notes'),
                      },
                    }),
                  t('Your quotation has been submitted.', 'تم تقديم عرض السعر.'),
                );
              }}
            >
              <div className="modal-body">
                <div className="modal-summary">
                  <Route size={22} />
                  <div>
                    <strong>
                      {modal.request.origin} → {modal.request.destination}
                    </strong>
                    <span>
                      {modal.request.reference} · {modal.request.cargo}
                    </span>
                  </div>
                </div>
                <label className="field">
                  <span>{t('Total quotation (DZD)', 'إجمالي العرض (دج)')}</span>
                  <input
                    name="amountDzd"
                    type="number"
                    min="1"
                    max="1000000000"
                    step="1"
                    required
                    autoFocus
                    placeholder="24000"
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    <span>{t('Estimated delivery (days)', 'مدة التسليم المقدرة (أيام)')}</span>
                    <input
                      name="estimatedDays"
                      type="number"
                      min="1"
                      max="365"
                      step="1"
                      required
                      defaultValue="1"
                    />
                  </label>
                  <label className="field">
                    <span>{t('Quotation valid until', 'العرض صالح حتى')}</span>
                    <input
                      name="validUntil"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </label>
                </div>
                <label className="field">
                  <span>
                    {t('Terms and notes', 'الشروط والملاحظات')}{' '}
                    <small>{t('Optional', 'اختياري')}</small>
                  </span>
                  <textarea
                    name="notes"
                    maxLength={2000}
                    rows={3}
                    placeholder={t(
                      'What is included in this quotation?',
                      'ما الذي يشمله هذا العرض؟',
                    )}
                  />
                </label>
                <p className="form-hint">
                  <LockKeyhole size={14} />
                  {t(
                    'Other transport providers cannot see your quotation.',
                    'لا تستطيع شركات النقل الأخرى الاطلاع على عرضك.',
                  )}
                </p>
              </div>
              <FormFooter
                busy={busy}
                cancel={() => setModal(null)}
                submit={t('Submit quotation', 'تقديم العرض')}
                t={t}
              />
            </form>
          )}
          {modal.type === 'accept' && (
            <div>
              <div className="modal-body">
                <div className="modal-summary">
                  <Truck size={24} />
                  <div>
                    <strong>{modal.quote.providerCompanyName}</strong>
                    <span>
                      {modal.request.origin} → {modal.request.destination}
                    </span>
                  </div>
                </div>
                <div className="confirmation-value">
                  <span>{t('AGREED QUOTATION', 'عرض السعر المتفق عليه')}</span>
                  <strong>{money(modal.quote.amountDzd)}</strong>
                  <p>
                    {modal.quote.estimatedDays}{' '}
                    {t('estimated delivery days', 'أيام تقديرية للتسليم')}
                  </p>
                </div>
                <p className="confirm-description">
                  {t(
                    'Accepting creates one booking for this request and closes the other quotations. Check the partner, price and terms before you confirm.',
                    'ينشئ القبول حجزًا واحدًا لهذا الطلب ويغلق العروض الأخرى. تحقق من الشريك والسعر والشروط قبل التأكيد.',
                  )}
                </p>
                <p className="form-hint">
                  <CircleHelp size={15} />
                  {t('No payment is taken by this application.', 'لا يُحصّل التطبيق أي دفعة.')}
                </p>
              </div>
              <div className="modal-footer">
                <button className="button secondary" disabled={busy} onClick={() => setModal(null)}>
                  {t('Go back', 'رجوع')}
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => api(`/quotes/${modal.quote.id}/accept`, { body: {} }),
                      t(
                        'Quotation accepted. Your booking is confirmed.',
                        'تم قبول العرض وتأكيد الحجز.',
                      ),
                    )
                  }
                >
                  {busy ? <Loader2 className="spin" size={17} /> : <Check size={17} />}{' '}
                  {t('Confirm booking', 'تأكيد الحجز')}
                </button>
              </div>
            </div>
          )}
          {modal.type === 'transition' && (
            <div>
              <div className="modal-body">
                <div className="modal-summary">
                  <Truck size={24} />
                  <div>
                    <strong>{modal.booking.reference}</strong>
                    <span>
                      {modal.booking.origin} → {modal.booking.destination}
                    </span>
                  </div>
                </div>
                <div className="transition-preview">
                  <Status value={modal.booking.status} t={t} />
                  <ArrowRight size={20} />
                  <Status value={modal.status} t={t} />
                </div>
                <p className="confirm-description">
                  {modal.status === 'in_transit'
                    ? t(
                        'Confirm that your team has collected the shipment and transport has started. The customer will see this update.',
                        'أكد أن فريقك استلم الشحنة وبدأ النقل. سيظهر هذا التحديث للعميل.',
                      )
                    : modal.status === 'delivered'
                      ? t(
                          'Confirm that your team has delivered the shipment. The customer will then confirm receipt to complete the booking.',
                          'أكد أن فريقك سلّم الشحنة. يؤكد العميل الاستلام بعد ذلك لإكمال الحجز.',
                        )
                      : t(
                          'Confirm that your company has received the shipment. This completes the booking and allows you to leave a review.',
                          'أكد أن شركتك استلمت الشحنة. يؤدي ذلك إلى إكمال الحجز وإتاحة التقييم.',
                        )}
                </p>
              </div>
              <div className="modal-footer">
                <button className="button secondary" onClick={() => setModal(null)} disabled={busy}>
                  {t('Go back', 'رجوع')}
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () =>
                        api(`/bookings/${modal.booking.id}/status`, {
                          method: 'PATCH',
                          body: { status: modal.status, version: modal.booking.version },
                        }),
                      t('Booking status updated.', 'تم تحديث حالة الحجز.'),
                    )
                  }
                >
                  {busy ? <Loader2 size={17} className="spin" /> : <Check size={17} />}{' '}
                  {t('Confirm update', 'تأكيد التحديث')}
                </button>
              </div>
            </div>
          )}
          {modal.type === 'cancel' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void act(
                  () =>
                    api(`/bookings/${modal.booking.id}/status`, {
                      method: 'PATCH',
                      body: {
                        status: 'cancelled',
                        version: modal.booking.version,
                        reason: form.get('reason'),
                      },
                    }),
                  t(
                    'Booking cancelled. The reason is recorded in the activity log.',
                    'تم إلغاء الحجز وتسجيل السبب في سجل النشاط.',
                  ),
                );
              }}
            >
              <div className="modal-body">
                <div className="modal-summary">
                  <XCircle size={24} />
                  <div>
                    <strong>{modal.booking.reference}</strong>
                    <span>
                      {modal.booking.origin} → {modal.booking.destination}
                    </span>
                  </div>
                </div>
                <p className="confirm-description">
                  {t(
                    'You can cancel before transport begins. The booking and its history will remain visible; the request will not reopen automatically.',
                    'يمكنك الإلغاء قبل بدء النقل. يظل الحجز وسجله ظاهرين؛ ولا يُعاد فتح الطلب تلقائيًا.',
                  )}
                </p>
                <label className="field">
                  <span>{t('Cancellation reason', 'سبب الإلغاء')}</span>
                  <textarea
                    name="reason"
                    minLength={3}
                    maxLength={500}
                    rows={3}
                    required
                    autoFocus
                    placeholder={t(
                      'Explain why this booking is being cancelled.',
                      'وضح سبب إلغاء الحجز.',
                    )}
                  />
                </label>
              </div>
              <FormFooter
                busy={busy}
                cancel={() => setModal(null)}
                submit={t('Cancel booking', 'إلغاء الحجز')}
                danger
                t={t}
              />
            </form>
          )}
          {modal.type === 'review' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void act(
                  () =>
                    api(`/bookings/${modal.booking.id}/review`, {
                      body: { rating: Number(form.get('rating')), comment: form.get('comment') },
                    }),
                  t('Thank you. Your review has been recorded.', 'شكرًا لك. تم تسجيل تقييمك.'),
                );
              }}
            >
              <div className="modal-body">
                <div className="modal-summary">
                  <Star size={24} />
                  <div>
                    <strong>{modal.booking.providerCompanyName}</strong>
                    <span>{modal.booking.reference}</span>
                  </div>
                </div>
                <label className="field">
                  <span>{t('Overall rating', 'التقييم العام')}</span>
                  <select name="rating" defaultValue="5" autoFocus>
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating} / 5 —{' '}
                        {rating === 5
                          ? t('Excellent', 'ممتاز')
                          : rating === 4
                            ? t('Good', 'جيد')
                            : rating === 3
                              ? t('Satisfactory', 'مقبول')
                              : rating === 2
                                ? t('Needs improvement', 'يحتاج تحسينًا')
                                : t('Poor', 'ضعيف')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t('Your experience', 'تجربتك')}</span>
                  <textarea
                    name="comment"
                    minLength={3}
                    maxLength={1000}
                    rows={4}
                    required
                    placeholder={t(
                      'Share feedback about communication and delivery.',
                      'شارك ملاحظاتك حول التواصل والتسليم.',
                    )}
                  />
                </label>
                <p className="form-hint">
                  {t(
                    'One review per completed booking. Reviews cannot be edited here.',
                    'تقييم واحد لكل حجز مكتمل. لا يمكن تعديل التقييم هنا.',
                  )}
                </p>
              </div>
              <FormFooter
                busy={busy}
                cancel={() => setModal(null)}
                submit={t('Submit review', 'إرسال التقييم')}
                t={t}
              />
            </form>
          )}
          {modal.type === 'company' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void act(
                  () =>
                    api(`/companies/${modal.company.id}/status`, {
                      method: 'PATCH',
                      body: { status: modal.status, reason: form.get('reason') },
                    }),
                  modal.status === 'verified'
                    ? t(
                        'Company verified. Operational access is enabled.',
                        'تم توثيق الشركة وتفعيل صلاحياتها.',
                      )
                    : t(
                        'Company suspended. Operational access is restricted.',
                        'تم إيقاف الشركة وتقييد صلاحياتها.',
                      ),
                );
              }}
            >
              <div className="modal-body">
                <div className="modal-summary">
                  <Building2 size={24} />
                  <div>
                    <strong>{modal.company.name}</strong>
                    <span>
                      {modal.company.city} · {t(...statuses[modal.company.kind])}
                    </span>
                  </div>
                </div>
                <p className="confirm-description">
                  {modal.status === 'verified'
                    ? t(
                        'Verify only after reviewing the company’s eligibility. This grants operational access to its users.',
                        'وثّق الشركة بعد مراجعة أهليتها. يتيح ذلك الصلاحيات التشغيلية لمستخدميها.',
                      )
                    : t(
                        'Suspending this company restricts operational actions. Existing records are preserved.',
                        'يؤدي إيقاف الشركة إلى تقييد إجراءاتها التشغيلية. تُحفظ السجلات الحالية.',
                      )}
                </p>
                <label className="field">
                  <span>{t('Decision reason', 'سبب القرار')}</span>
                  <textarea
                    name="reason"
                    minLength={3}
                    maxLength={500}
                    rows={3}
                    required
                    autoFocus
                    placeholder={t('Record the basis for this decision.', 'سجل أساس هذا القرار.')}
                  />
                </label>
              </div>
              <FormFooter
                busy={busy}
                cancel={() => setModal(null)}
                submit={
                  modal.status === 'verified'
                    ? t('Verify company', 'توثيق الشركة')
                    : t('Suspend company', 'إيقاف الشركة')
                }
                danger={modal.status === 'suspended'}
                t={t}
              />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
function FormFooter({
  busy,
  cancel,
  submit,
  danger = false,
  t,
}: {
  busy: boolean;
  cancel: () => void;
  submit: string;
  danger?: boolean;
  t: Translate;
}) {
  return (
    <div className="modal-footer">
      <button className="button secondary" type="button" onClick={cancel} disabled={busy}>
        {t('Go back', 'رجوع')}
      </button>
      <button
        className={`button ${danger ? 'danger-button' : 'primary'}`}
        type="submit"
        disabled={busy}
      >
        {busy && <Loader2 size={17} className="spin" />}
        {busy ? t('Saving…', 'جارٍ الحفظ…') : submit}
        {!busy && !danger && <ArrowRight size={16} />}
      </button>
    </div>
  );
}
