import { z } from 'zod';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function addDays(date, days) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function validity(date, current = today()) {
  if (!date) return { days: null, status: 'unpaid', label: 'Non payé' };
  const days = Math.round((Date.parse(date) - Date.parse(current)) / 86400000);
  if (days <= 0) return { days, status: 'expired', label: 'Expiré' };
  return { days, status: days > 20 ? 'active' : days >= 10 ? 'warning' : 'urgent', label: `${days} jours restants` };
}
export function calculateValidity(payments) {
  let end = null;
  for (const payment of payments) {
    if (!payment.duration_days) continue;
    end = addDays(end && end > payment.operation_date ? end : payment.operation_date, payment.duration_days);
  }
  return end;
}
// Paie des enseignants : mois au format AAAA-MM, montants entiers en FCFA.
export const periodBounds = period => {
  const [year, month] = period.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [`${period}-01`, `${period}-${String(last).padStart(2, '0')}`];
};
export const sessionAmount = (minutes, rate) => Math.round(minutes * rate / 60);
export function payrollSummary({ pay_type, monthly_salary, sessions_amount, advances, paid }) {
  const gross = Number(pay_type === 'monthly' ? monthly_salary : sessions_amount) || 0;
  const remaining = gross - Number(advances || 0) - Number(paid || 0);
  const status = remaining < 0 ? 'overpaid' : remaining === 0 ? (gross ? 'paid' : 'none') : Number(advances || 0) + Number(paid || 0) ? 'partial' : 'due';
  return { gross, advances: Number(advances || 0), paid: Number(paid || 0), remaining, status };
}
const text = (min, max) => z.string().trim().min(min).max(max);
export const period = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, 'Mois invalide.');
export const isoDate = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/, 'Date invalide.').refine(v => !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) && new Date(`${v}T12:00:00Z`).toISOString().startsWith(v), 'Date invalide.');
export const id = z.coerce.number().int().positive();
export const password = z.string().min(12, 'Le mot de passe doit contenir au moins 12 caractères.').max(72).refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Le mot de passe dépasse 72 octets.');
export const email = z.string().trim().toLowerCase().email().max(190);
export const schoolYear = z.string().regex(/^20\d{2}-20\d{2}$/).refine(v => Number(v.slice(5)) === Number(v.slice(0, 4)) + 1, 'Session scolaire invalide.');
const phone = z.string().trim().max(30).regex(/^(?:\+?237[\s.-]?)?[2368][\d\s.-]{8,16}$/, 'Numéro camerounais invalide.').refine(v => { const n=v.replace(/\D/g,''); return n.length===9 || (n.startsWith('237') && n.length===12); }, 'Utilisez 9 chiffres ou +237 suivi de 9 chiffres.');
export const schemas = {
  setup: z.object({ name: text(2,120), email, password, token: z.string().min(32).max(200) }),
  login: z.object({ email, password: z.string().min(1).max(200) }),
  center: z.object({ name: text(2,100), address: text(3,240), phone: z.union([phone,z.literal('')]).default('') }),
  student: z.object({ center_id: id, name: text(2,140), class_name: text(1,60), group_name: text(0,80).default(''), school_year: schoolYear, parent_name: text(2,140), parent_phone: phone, parent_email: z.union([email,z.literal('')]).default(''), notes: text(0,1000).default('') }),
  tariff: z.object({ name: text(2,100), amount: z.coerce.number().int().min(1).max(10000000), duration_days: z.coerce.number().int().min(0).max(366), active: z.boolean().default(true) }),
  user: z.object({ name: text(2,120), email, password, center_id: id }),
  userEdit: z.object({ name: text(2,120), email, center_id: id, active: z.boolean(), password: z.union([password,z.literal('')]).optional() }),
  payment: z.object({ student_id: id, tariff_id: id, method: z.enum(['cash','mtn','orange','bank']), request_key: z.string().uuid() }),
  movement: z.object({ center_id: id, kind: z.enum(['income','expense','opening']), amount: z.coerce.number().int().min(1).max(100000000), category: text(2,100), description: text(3,300), method: z.enum(['cash','mtn','orange','bank']), request_key: z.string().uuid() }),
  reversal: z.object({ reason: text(5,250), request_key: z.string().uuid() }),
  changePassword: z.object({ current_password: z.string().min(1).max(200), password }),
  teacher: z.object({ name: text(2,140), phone: z.union([phone,z.literal('')]).default(''), subjects: text(0,200).default(''), pay_type: z.enum(['hourly','monthly']), hourly_rate: z.coerce.number().int().min(0).max(1000000).default(0), monthly_salary: z.coerce.number().int().min(0).max(50000000).default(0), hired_on: isoDate, active: z.boolean().default(true), notes: text(0,1000).default('') })
    .refine(t => t.pay_type === 'hourly' ? t.hourly_rate > 0 : t.monthly_salary > 0, { message: 'Indiquez le taux horaire ou le salaire mensuel selon le mode de paie.', path: ['pay_type'] }),
  teacherSession: z.object({ teacher_id: id, center_id: id, session_date: isoDate, hours: z.coerce.number().min(0.25, 'Durée minimale : 15 minutes.').max(12, 'Durée maximale : 12 heures.'), subject: text(0,100).default(''), class_name: text(0,100).default(''), request_key: z.string().uuid() }),
  teacherPayment: z.object({ center_id: id, period, kind: z.enum(['salary','advance']), amount: z.coerce.number().int().min(1).max(50000000), method: z.enum(['cash','mtn','orange','bank']), description: text(0,300).default(''), request_key: z.string().uuid() }),
};
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function ensureScope(user, centerId) {
  if (user.role !== 'manager' && Number(centerId) !== user.center_id) throw new HttpError(403, 'Vous ne pouvez accéder qu’aux données de votre siège.');
}
export function centerScope(user, requested) {
  if (requested !== undefined && requested !== '' && requested !== 'all') {
    const value = id.parse(requested); ensureScope(user, value); return value;
  }
  return user.role === 'manager' ? null : user.center_id;
}
