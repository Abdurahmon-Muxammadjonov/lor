import type { Organ } from '@prisma/client';

export type ServiceUnit = 'ta' | 'seans' | 'kun';

export interface ServiceSeed {
  /** Kategoriya kaliti (categories.ts dagi key) */
  category: string;
  code: string;
  name: string;
  nameRu: string;
  unit: ServiceUnit;
  priceAdultNoMed: number;
  priceAdultMed: number;
  priceChildNoMed: number;
  priceChildMed: number;
  allowHalf: boolean;
  medicineOptional: boolean;
  durationMin: number;
  defaultOrgan: Organ | null;
  order: number;
}

interface SvcOpts {
  unit?: ServiceUnit;
  allowHalf?: boolean;
  medicineOptional?: boolean;
  organ?: Organ | null;
}

let orderCounter = 0;

/**
 * Qisqa yaratuvchi. Narxlar: [kattalar dorisiz, kattalar dori bilan, bolalar dorisiz, bolalar dori bilan].
 * Qoida: bolalar < kattalar, dori bilan > dorisiz, hammasi butun ming soʻm.
 */
function svc(
  category: string,
  code: string,
  name: string,
  nameRu: string,
  prices: [number, number, number, number],
  durationMin: number,
  opts: SvcOpts = {},
): ServiceSeed {
  const [priceAdultNoMed, priceAdultMed, priceChildNoMed, priceChildMed] = prices;
  for (const p of prices) {
    if (p % 1000 !== 0) throw new Error(`Narx butun ming boʻlishi kerak: ${code} ${p}`);
  }
  if (!(priceChildNoMed < priceAdultNoMed && priceChildMed < priceAdultMed)) {
    throw new Error(`Bolalar narxi kattalardan kichik boʻlishi kerak: ${code}`);
  }
  if (!(priceAdultMed > priceAdultNoMed && priceChildMed > priceChildNoMed)) {
    throw new Error(`Dori bilan narx dorisizdan katta boʻlishi kerak: ${code}`);
  }
  orderCounter += 1;
  return {
    category,
    code,
    name,
    nameRu,
    unit: opts.unit ?? 'ta',
    priceAdultNoMed,
    priceAdultMed,
    priceChildNoMed,
    priceChildMed,
    allowHalf: opts.allowHalf ?? true,
    medicineOptional: opts.medicineOptional ?? true,
    durationMin,
    defaultOrgan: opts.organ ?? null,
    order: orderCounter,
  };
}

const EXAM: SvcOpts = { allowHalf: false, organ: 'OTHER' };
const OP: SvcOpts = { allowHalf: false };
const LAB: SvcOpts = { allowHalf: false, organ: 'OTHER' };

/** Demo klinika xizmatlari — 63 ta haqiqiy LOR xizmati */
export const SERVICES: ServiceSeed[] = [
  // ── D: Koʻrik va diagnostika ──
  svc('D', 'D-001', 'Birlamchi koʻrik', 'Первичный осмотр', [80000, 100000, 60000, 80000], 20, EXAM),
  svc('D', 'D-002', 'Qayta koʻrik', 'Повторный осмотр', [50000, 70000, 40000, 60000], 15, EXAM),
  svc(
    'D',
    'D-003',
    'Endoskopik koʻrik (burun)',
    'Эндоскопический осмотр (нос)',
    [150000, 180000, 120000, 150000],
    20,
    {
      allowHalf: false,
      organ: 'NOSE',
    },
  ),
  svc(
    'D',
    'D-004',
    'Endoskopik koʻrik (hiqildoq)',
    'Эндоскопический осмотр (гортань)',
    [160000, 190000, 130000, 160000],
    20,
    { allowHalf: false, organ: 'LARYNX' },
  ),
  svc('D', 'D-005', 'Audiometriya', 'Аудиометрия', [120000, 130000, 100000, 110000], 30, {
    allowHalf: false,
    organ: 'EAR',
  }),
  svc('D', 'D-006', 'Timpanometriya', 'Тимпанометрия', [100000, 110000, 80000, 90000], 20, {
    allowHalf: false,
    organ: 'EAR',
  }),
  svc('D', 'D-007', 'Rinoskopiya', 'Риноскопия', [60000, 80000, 50000, 70000], 10, {
    allowHalf: false,
    organ: 'NOSE',
  }),
  svc('D', 'D-008', 'Otoskopiya', 'Отоскопия', [60000, 80000, 50000, 70000], 10, {
    allowHalf: false,
    organ: 'EAR',
  }),
  svc('D', 'D-009', 'Faringoskopiya', 'Фарингоскопия', [50000, 70000, 40000, 60000], 10, {
    allowHalf: false,
    organ: 'THROAT',
  }),
  svc(
    'D',
    'D-010',
    'Otoakustik emissiya (OAE)',
    'Отоакустическая эмиссия (ОАЭ)',
    [150000, 160000, 120000, 130000],
    20,
    {
      allowHalf: false,
      organ: 'EAR',
    },
  ),
  svc('D', 'D-011', 'Videolaringoskopiya', 'Видеоларингоскопия', [200000, 230000, 160000, 190000], 25, {
    allowHalf: false,
    organ: 'LARYNX',
  }),

  // ── N: Burun muolajalari ──
  svc(
    'N',
    'N-001',
    'Burun yuvish (kukushka / ANTK)',
    'Промывание носа («кукушка» / АНТК)',
    [120000, 150000, 90000, 110000],
    20,
    {
      unit: 'seans',
      organ: 'NOSE',
    },
  ),
  svc(
    'N',
    'N-002',
    'Burun boʻshligʻini tamponadalash',
    'Тампонада полости носа',
    [100000, 130000, 80000, 100000],
    20,
    {
      organ: 'NOSE',
    },
  ),
  svc(
    'N',
    'N-003',
    'Gaymorit punksiyasi',
    'Пункция гайморовой пазухи',
    [250000, 300000, 200000, 240000],
    30,
    { organ: 'NOSE' },
  ),
  svc('N', 'N-004', 'YAMIK kateter', 'ЯМИК-катетер', [300000, 350000, 240000, 280000], 30, {
    unit: 'seans',
    organ: 'NOSE',
  }),
  svc(
    'N',
    'N-005',
    'Burun toʻsigʻini anemizatsiya',
    'Анемизация слизистой носа',
    [40000, 60000, 30000, 50000],
    10,
    {
      medicineOptional: false,
      organ: 'NOSE',
    },
  ),
  svc('N', 'N-006', 'Burun polipini olish', 'Удаление полипа носа', [800000, 900000, 700000, 800000], 40, {
    allowHalf: false,
    organ: 'NOSE',
  }),
  svc(
    'N',
    'N-007',
    'Burun qon ketishini toʻxtatish (koagulyatsiya)',
    'Остановка носового кровотечения (коагуляция)',
    [200000, 250000, 150000, 200000],
    20,
    { organ: 'NOSE' },
  ),
  svc(
    'N',
    'N-008',
    'Burunga dori tomizish / turunda',
    'Закапывание / турунда в нос',
    [30000, 50000, 25000, 40000],
    10,
    {
      medicineOptional: false,
      organ: 'NOSE',
    },
  ),
  svc(
    'N',
    'N-009',
    'Burun boʻshligʻini sanatsiya qilish',
    'Санация полости носа',
    [60000, 90000, 50000, 70000],
    15,
    {
      organ: 'NOSE',
    },
  ),
  svc(
    'N',
    'N-010',
    'Burundan yot jismni olish',
    'Удаление инородного тела из носа',
    [150000, 180000, 120000, 150000],
    20,
    {
      allowHalf: false,
      organ: 'NOSE',
    },
  ),
  svc(
    'N',
    'N-011',
    'Burun chigʻanoqlarini kuydirish',
    'Прижигание носовых раковин',
    [250000, 300000, 200000, 250000],
    20,
    {
      allowHalf: false,
      organ: 'NOSE',
    },
  ),

  // ── E: Quloq muolajalari ──
  svc(
    'E',
    'E-001',
    'Quloq yuvish (sera probkasi olish)',
    'Промывание уха (удаление серной пробки)',
    [80000, 100000, 60000, 80000],
    15,
    {
      organ: 'EAR',
    },
  ),
  svc(
    'E',
    'E-002',
    'Quloq pardasi pufflash (Politser)',
    'Продувание слуховых труб по Политцеру',
    [60000, 80000, 50000, 60000],
    10,
    { unit: 'seans', organ: 'EAR' },
  ),
  svc(
    'E',
    'E-003',
    'Quloq tomizish / turunda',
    'Закапывание / турунда в ухо',
    [30000, 50000, 25000, 40000],
    10,
    {
      medicineOptional: false,
      organ: 'EAR',
    },
  ),
  svc('E', 'E-004', 'Timpanopunksiya', 'Тимпанопункция', [300000, 350000, 250000, 300000], 25, {
    allowHalf: false,
    organ: 'EAR',
  }),
  svc(
    'E',
    'E-005',
    'Quloq pnevmomassaji',
    'Пневмомассаж барабанной перепонки',
    [50000, 60000, 40000, 50000],
    10,
    {
      unit: 'seans',
      organ: 'EAR',
    },
  ),
  svc(
    'E',
    'E-006',
    'Quloqdan yot jismni olish',
    'Удаление инородного тела из уха',
    [150000, 180000, 120000, 150000],
    20,
    {
      allowHalf: false,
      organ: 'EAR',
    },
  ),
  svc(
    'E',
    'E-007',
    'Tashqi quloq yoʻlini tozalash',
    'Туалет наружного слухового прохода',
    [50000, 70000, 40000, 60000],
    10,
    {
      organ: 'EAR',
    },
  ),
  svc(
    'E',
    'E-008',
    'Eshitish nayini kateterizatsiya qilish',
    'Катетеризация слуховой трубы',
    [120000, 150000, 100000, 120000],
    20,
    {
      organ: 'EAR',
    },
  ),
  svc('E', 'E-009', 'Quloq orqasiga blokada', 'Заушная блокада', [100000, 130000, 80000, 100000], 15, {
    medicineOptional: false,
    organ: 'EAR',
  }),

  // ── T: Tomoq muolajalari ──
  svc(
    'T',
    'T-001',
    'Bodomcha lakunalarini yuvish',
    'Промывание лакун миндалин',
    [80000, 110000, 60000, 90000],
    15,
    {
      unit: 'seans',
      organ: 'THROAT',
    },
  ),
  svc(
    'T',
    'T-002',
    'Bodomchaga dori surtish',
    'Смазывание миндалин лекарством',
    [30000, 50000, 25000, 40000],
    5,
    {
      medicineOptional: false,
      organ: 'THROAT',
    },
  ),
  svc(
    'T',
    'T-003',
    'Hiqildoqqa dori quyish',
    'Вливание лекарства в гортань',
    [60000, 80000, 50000, 70000],
    10,
    {
      medicineOptional: false,
      organ: 'LARYNX',
    },
  ),
  svc(
    'T',
    'T-004',
    'Faringit bilan tomoqni ishlov berish',
    'Обработка глотки при фарингите',
    [50000, 70000, 40000, 60000],
    10,
    {
      organ: 'THROAT',
    },
  ),
  svc(
    'T',
    'T-005',
    'Paratonzillyar abssessni ochish',
    'Вскрытие паратонзиллярного абсцесса',
    [400000, 450000, 320000, 370000],
    30,
    { allowHalf: false, organ: 'THROAT' },
  ),
  svc(
    'T',
    'T-006',
    'Bodomchalarni vakuum bilan yuvish (Tonzillor)',
    'Вакуумное промывание миндалин (Тонзиллор)',
    [120000, 150000, 90000, 120000],
    20,
    { unit: 'seans', organ: 'THROAT' },
  ),
  svc(
    'T',
    'T-007',
    'Tomoqdan yot jismni olish',
    'Удаление инородного тела из глотки',
    [150000, 180000, 120000, 150000],
    20,
    {
      allowHalf: false,
      organ: 'THROAT',
    },
  ),
  svc(
    'T',
    'T-008',
    'Halqum orqa devori granulalarini kuydirish',
    'Прижигание гранул задней стенки глотки',
    [200000, 250000, 160000, 200000],
    15,
    { organ: 'THROAT' },
  ),

  // ── F: Fizioterapiya ──
  svc('F', 'F-001', 'UFO (kvarts)', 'УФО (кварц)', [30000, 40000, 25000, 35000], 10, {
    unit: 'seans',
    organ: 'OTHER',
  }),
  svc('F', 'F-002', 'Lazer terapiya', 'Лазеротерапия', [50000, 60000, 40000, 50000], 15, {
    unit: 'seans',
    organ: 'OTHER',
  }),
  svc('F', 'F-003', 'UVCh', 'УВЧ', [40000, 50000, 30000, 40000], 15, { unit: 'seans', organ: 'OTHER' }),
  svc(
    'F',
    'F-004',
    'Ultratovush ingalyatsiya (nebulayzer)',
    'Ультразвуковая ингаляция (небулайзер)',
    [40000, 60000, 30000, 50000],
    15,
    {
      unit: 'seans',
      organ: 'OTHER',
    },
  ),
  svc('F', 'F-005', 'Elektroforez', 'Электрофорез', [50000, 70000, 40000, 60000], 20, {
    unit: 'seans',
    organ: 'OTHER',
  }),
  svc('F', 'F-006', 'Magnitoterapiya', 'Магнитотерапия', [40000, 50000, 30000, 40000], 15, {
    unit: 'seans',
    organ: 'OTHER',
  }),
  svc('F', 'F-007', 'Fonoforez', 'Фонофорез', [50000, 70000, 40000, 60000], 15, {
    unit: 'seans',
    organ: 'OTHER',
  }),
  svc('F', 'F-008', 'Darsonval', 'Дарсонвализация', [40000, 50000, 30000, 40000], 10, {
    unit: 'seans',
    organ: 'OTHER',
  }),

  // ── S: Kichik operatsiyalar ──
  svc('S', 'S-001', 'Adenotomiya', 'Аденотомия', [2500000, 2800000, 2000000, 2300000], 60, {
    ...OP,
    organ: 'THROAT',
  }),
  svc('S', 'S-002', 'Tonzillotomiya', 'Тонзиллотомия', [2000000, 2300000, 1600000, 1900000], 45, {
    ...OP,
    organ: 'THROAT',
  }),
  svc('S', 'S-003', 'Tonzillektomiya', 'Тонзиллэктомия', [3500000, 3900000, 3000000, 3400000], 90, {
    ...OP,
    organ: 'THROAT',
  }),
  svc('S', 'S-004', 'Septoplastika', 'Септопластика', [4500000, 5000000, 4000000, 4500000], 120, {
    ...OP,
    organ: 'NOSE',
  }),
  svc('S', 'S-005', 'Vazotomiya', 'Вазотомия', [1500000, 1800000, 1200000, 1500000], 40, {
    ...OP,
    organ: 'NOSE',
  }),
  svc(
    'S',
    'S-006',
    'Quloq pardasini shuntlash',
    'Шунтирование барабанной перепонки',
    [1800000, 2100000, 1500000, 1800000],
    45,
    {
      ...OP,
      organ: 'EAR',
    },
  ),
  svc(
    'S',
    'S-007',
    'Quloq supragi keloidini olish',
    'Удаление келоида ушной раковины',
    [1200000, 1400000, 1000000, 1200000],
    40,
    {
      ...OP,
      organ: 'EAR',
    },
  ),
  svc('S', 'S-008', 'Uvulopalatoplastika', 'Увулопалатопластика', [3000000, 3400000, 2600000, 3000000], 60, {
    ...OP,
    organ: 'THROAT',
  }),

  // ── L: Analizlar ──
  svc('L', 'L-001', 'Umumiy qon tahlili', 'Общий анализ крови', [50000, 60000, 45000, 55000], 10, LAB),
  svc(
    'L',
    'L-002',
    'Burun surtmasi (bakposev)',
    'Мазок из носа (бакпосев)',
    [90000, 100000, 80000, 90000],
    10,
    { ...LAB, organ: 'NOSE' },
  ),
  svc('L', 'L-003', 'Tomoq surtmasi', 'Мазок из зева', [90000, 100000, 80000, 90000], 10, {
    ...LAB,
    organ: 'THROAT',
  }),
  svc('L', 'L-004', 'Allergik panel', 'Аллергопанель', [350000, 380000, 300000, 330000], 15, LAB),
  svc('L', 'L-005', 'Strep-test', 'Стреп-тест', [80000, 90000, 70000, 80000], 10, {
    ...LAB,
    organ: 'THROAT',
  }),
  svc(
    'L',
    'L-006',
    'Quloqdan surtma (bakposev)',
    'Мазок из уха (бакпосев)',
    [90000, 100000, 80000, 90000],
    10,
    { ...LAB, organ: 'EAR' },
  ),
  svc(
    'L',
    'L-007',
    'Sitologik tekshiruv (burun)',
    'Цитологическое исследование (нос)',
    [120000, 130000, 100000, 110000],
    15,
    {
      ...LAB,
      organ: 'NOSE',
    },
  ),
  svc('L', 'L-008', 'Umumiy IgE', 'Общий IgE', [120000, 130000, 100000, 110000], 10, LAB),
];

/** Xizmatni kodi boʻyicha topish (mavjud boʻlmasa xato) */
export function serviceByCode(code: string): ServiceSeed {
  const s = SERVICES.find((x) => x.code === code);
  if (!s) throw new Error(`Xizmat topilmadi: ${code}`);
  return s;
}

/** Narxni 90 % ga kamaytirib, butun mingga yaxlitlash */
function scale(price: number, k: number): number {
  return Math.max(1000, Math.round((price * k) / 1000) * 1000);
}

/** LOR Plus Medical xizmatlari — 10 ta, demo roʻyxatdan olingan, narxlari boshqacha */
export const LOR_PLUS_SERVICES: ServiceSeed[] = (
  [
    ['D-001', 'D', 'P-001'],
    ['D-002', 'D', 'P-002'],
    ['D-005', 'D', 'P-003'],
    ['N-001', 'P', 'P-004'],
    ['N-003', 'P', 'P-005'],
    ['E-001', 'P', 'P-006'],
    ['T-001', 'P', 'P-007'],
    ['T-003', 'P', 'P-008'],
    ['F-001', 'F', 'P-009'],
    ['F-004', 'F', 'P-010'],
  ] as const
).map(([src, category, code], i) => {
  const s = serviceByCode(src);
  return {
    ...s,
    category,
    code,
    priceAdultNoMed: scale(s.priceAdultNoMed, 0.9),
    priceAdultMed: scale(s.priceAdultMed, 0.9),
    priceChildNoMed: scale(s.priceChildNoMed, 0.9),
    priceChildMed: scale(s.priceChildMed, 0.9),
    order: i + 1,
  };
});
