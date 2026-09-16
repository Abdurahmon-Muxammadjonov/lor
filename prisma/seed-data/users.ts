import type { Role, SalaryType } from '@prisma/client';
import { parseWeeklySchedule, type WeeklySchedule } from '../../src/lib/settings/types';

export interface UserSeed {
  /** Klinika slug (qaysi klinikaga tegishli) */
  clinicSlug: string;
  login: string;
  password: string;
  email: string | null;
  fullName: string;
  role: Role;
  phone: string | null;
  specialty: string | null;
  room: string | null;
  color: string;
  salaryType: SalaryType;
  salaryValue: number;
  schedule: WeeklySchedule;
}

/** Dush–Jum 09:00–18:00 (tanaffus 13–14), Shanba 09:00–14:00, Yakshanba dam */
const DOCTOR_STANDARD = parseWeeklySchedule({
  0: { enabled: false },
  1: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  2: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  3: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  4: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  5: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  6: { enabled: true, start: '09:00', end: '14:00' },
});

/** Ertalabki smena: Dush–Shan 08:00–16:00 */
const DOCTOR_MORNING = parseWeeklySchedule({
  0: { enabled: false },
  1: { enabled: true, start: '08:00', end: '16:00', breakStart: '12:00', breakEnd: '12:30' },
  2: { enabled: true, start: '08:00', end: '16:00', breakStart: '12:00', breakEnd: '12:30' },
  3: { enabled: true, start: '08:00', end: '16:00', breakStart: '12:00', breakEnd: '12:30' },
  4: { enabled: true, start: '08:00', end: '16:00', breakStart: '12:00', breakEnd: '12:30' },
  5: { enabled: true, start: '08:00', end: '16:00', breakStart: '12:00', breakEnd: '12:30' },
  6: { enabled: true, start: '08:00', end: '13:00' },
});

/** Kunduzgi smena: Dush–Jum 10:00–19:00, Shanba dam */
const DOCTOR_LATE = parseWeeklySchedule({
  0: { enabled: false },
  1: { enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
  2: { enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
  3: { enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
  4: { enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
  5: { enabled: true, start: '10:00', end: '19:00', breakStart: '14:00', breakEnd: '15:00' },
  6: { enabled: false },
});

/** Registratura / kassa: Dush–Shan 08:00–20:00 */
const FRONT_DESK = parseWeeklySchedule({
  0: { enabled: false },
  1: { enabled: true, start: '08:00', end: '20:00' },
  2: { enabled: true, start: '08:00', end: '20:00' },
  3: { enabled: true, start: '08:00', end: '20:00' },
  4: { enabled: true, start: '08:00', end: '20:00' },
  5: { enabled: true, start: '08:00', end: '20:00' },
  6: { enabled: true, start: '08:00', end: '18:00' },
});

const ADMIN_SCHEDULE = parseWeeklySchedule({});

export const USERS: UserSeed[] = [
  {
    clinicSlug: 'demo',
    login: 'superadmin',
    password: 'Super123!',
    email: 'super@lor.uz',
    fullName: 'Tizim administratori',
    role: 'SUPER_ADMIN',
    phone: '+998901000001',
    specialty: null,
    room: null,
    color: '#FF4D6D',
    salaryType: 'FIXED',
    salaryValue: 0,
    schedule: ADMIN_SCHEDULE,
  },
  {
    clinicSlug: 'demo',
    login: 'admin',
    password: 'Admin123!',
    email: 'admin@lor.uz',
    fullName: 'Karimova Dilnoza Baxtiyorovna',
    role: 'ADMIN',
    phone: '+998901000002',
    specialty: 'Bosh shifokor',
    room: '1',
    color: '#7C5CFF',
    salaryType: 'FIXED',
    salaryValue: 12000000,
    schedule: ADMIN_SCHEDULE,
  },
  {
    clinicSlug: 'demo',
    login: 'abdurahmon',
    password: '12345678',
    email: null,
    fullName: 'Abdurahmon',
    role: 'ADMIN',
    phone: null,
    specialty: 'Administrator',
    room: null,
    color: '#7C5CFF',
    salaryType: 'FIXED',
    salaryValue: 0,
    schedule: ADMIN_SCHEDULE,
  },
  {
    clinicSlug: 'demo',
    login: 'doctor',
    password: 'Doctor123!',
    email: 'doctor@lor.uz',
    fullName: 'Rahimov Jasur Anvarovich',
    role: 'DOCTOR',
    phone: '+998901000003',
    specialty: 'LOR-shifokor',
    room: '3',
    color: '#00D4FF',
    salaryType: 'PERCENT',
    salaryValue: 30,
    schedule: DOCTOR_STANDARD,
  },
  {
    clinicSlug: 'demo',
    login: 'doctor2',
    password: 'Doctor123!',
    email: 'doctor2@lor.uz',
    fullName: 'Yusupova Malika Rustamovna',
    role: 'DOCTOR',
    phone: '+998901000004',
    specialty: 'LOR-shifokor, otoxirurg',
    room: '5',
    color: '#7C5CFF',
    salaryType: 'PERCENT',
    salaryValue: 35,
    schedule: DOCTOR_MORNING,
  },
  {
    clinicSlug: 'demo',
    login: 'doctor3',
    password: 'Doctor123!',
    email: 'doctor3@lor.uz',
    fullName: 'Toshmatov Bekzod Oʻktamovich',
    role: 'DOCTOR',
    phone: '+998901000005',
    specialty: 'Bolalar LOR-shifokori',
    room: '7',
    color: '#00FFB2',
    salaryType: 'FIXED',
    salaryValue: 8000000,
    schedule: DOCTOR_LATE,
  },
  {
    clinicSlug: 'demo',
    login: 'reception',
    password: 'Reception123!',
    email: 'reception@lor.uz',
    fullName: 'Nazarova Gulnora Sobirovna',
    role: 'RECEPTION',
    phone: '+998901000006',
    specialty: 'Registrator',
    room: 'Registratura',
    color: '#FFB800',
    salaryType: 'FIXED',
    salaryValue: 4500000,
    schedule: FRONT_DESK,
  },
  {
    clinicSlug: 'demo',
    login: 'cashier',
    password: 'Cashier123!',
    email: 'cashier@lor.uz',
    fullName: 'Ergashev Sardor Alisherovich',
    role: 'CASHIER',
    phone: '+998901000007',
    specialty: 'Kassir',
    room: 'Kassa',
    color: '#FF8A5C',
    salaryType: 'FIXED',
    salaryValue: 4500000,
    schedule: FRONT_DESK,
  },
  // ── LOR Plus Medical (Samarqand) ──
  {
    clinicSlug: 'lor-plus',
    login: 'admin2',
    password: 'Admin123!',
    email: 'admin@lorplus.uz',
    fullName: 'Saidov Otabek Farhodovich',
    role: 'ADMIN',
    phone: '+998902000001',
    specialty: 'Direktor',
    room: '1',
    color: '#7C5CFF',
    salaryType: 'FIXED',
    salaryValue: 10000000,
    schedule: ADMIN_SCHEDULE,
  },
  {
    clinicSlug: 'lor-plus',
    login: 'doctor4',
    password: 'Doctor123!',
    email: 'doctor@lorplus.uz',
    fullName: 'Mirzayeva Nilufar Shavkatovna',
    role: 'DOCTOR',
    phone: '+998902000002',
    specialty: 'LOR-shifokor',
    room: '2',
    color: '#00D4FF',
    salaryType: 'PERCENT',
    salaryValue: 40,
    schedule: DOCTOR_STANDARD,
  },
];
