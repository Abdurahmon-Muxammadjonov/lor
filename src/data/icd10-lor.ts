import type { Locale } from '@/i18n/config';
import { normalizeSearch } from '@/lib/utils';

/**
 * LOR (quloq-burun-tomoq) amaliyoti uchun ICD-10 (XKT-10) kodlari.
 *
 *  - H60–H95: quloq va soʻrgʻichsimon oʻsiq kasalliklari
 *  - J00–J39: yuqori nafas yoʻllari kasalliklari
 *  - qoʻshimcha: LOR amaliyotida tez-tez uchraydigan R/T/G kodlari (yot jism, burundan qon ketishi …)
 *
 * `ru` — МКБ-10 rasmiy nomlari, `uz` — oʻzbekcha (lotin) tarjima.
 */
export interface Icd10Entry {
  code: string;
  uz: string;
  ru: string;
}

export const ICD10_LOR: readonly Icd10Entry[] = [
  // ───────────── H60–H62: Tashqi quloq ─────────────
  { code: 'H60.0', uz: 'Tashqi quloq abssessi', ru: 'Абсцесс наружного уха' },
  { code: 'H60.1', uz: 'Tashqi quloq sellyuliti', ru: 'Целлюлит наружного уха' },
  { code: 'H60.2', uz: 'Malign (xavfli) tashqi otit', ru: 'Злокачественный наружный отит' },
  { code: 'H60.3', uz: 'Boshqa infeksion tashqi otitlar', ru: 'Другие инфекционные наружные отиты' },
  { code: 'H60.4', uz: 'Tashqi quloq xolesteatomasi', ru: 'Холестеатома наружного уха' },
  { code: 'H60.5', uz: 'Oʻtkir noinfeksion tashqi otit', ru: 'Острый наружный отит неинфекционный' },
  { code: 'H60.8', uz: 'Boshqa tashqi otitlar', ru: 'Другие наружные отиты' },
  { code: 'H60.9', uz: 'Tashqi otit, aniqlanmagan', ru: 'Наружный отит неуточненный' },
  { code: 'H61.0', uz: 'Tashqi quloq perixondriti', ru: 'Перихондрит наружного уха' },
  {
    code: 'H61.1',
    uz: 'Quloq suprasining noinfeksion kasalliklari',
    ru: 'Неинфекционные болезни ушной раковины',
  },
  { code: 'H61.2', uz: 'Oltingugurt tiqini', ru: 'Серная пробка' },
  {
    code: 'H61.3',
    uz: 'Tashqi eshitish yoʻlining orttirilgan stenozi',
    ru: 'Приобретенный стеноз наружного слухового канала',
  },
  {
    code: 'H61.8',
    uz: 'Tashqi quloqning boshqa aniqlangan kasalliklari',
    ru: 'Другие уточненные болезни наружного уха',
  },
  { code: 'H61.9', uz: 'Tashqi quloq kasalligi, aniqlanmagan', ru: 'Болезнь наружного уха неуточненная' },

  // ───────────── H65–H75: Oʻrta quloq va soʻrgʻichsimon oʻsiq ─────────────
  { code: 'H65.0', uz: 'Oʻtkir seroz oʻrta otit', ru: 'Острый средний серозный отит' },
  { code: 'H65.1', uz: 'Boshqa oʻtkir yiringsiz oʻrta otitlar', ru: 'Другие острые негнойные средние отиты' },
  { code: 'H65.2', uz: 'Surunkali seroz oʻrta otit', ru: 'Хронический серозный средний отит' },
  { code: 'H65.3', uz: 'Surunkali shilliqli oʻrta otit', ru: 'Хронический слизистый средний отит' },
  {
    code: 'H65.4',
    uz: 'Boshqa surunkali yiringsiz oʻrta otitlar',
    ru: 'Другие хронические негнойные средние отиты',
  },
  { code: 'H65.9', uz: 'Yiringsiz oʻrta otit, aniqlanmagan', ru: 'Негнойный средний отит неуточненный' },
  { code: 'H66.0', uz: 'Oʻtkir yiringli oʻrta otit', ru: 'Острый гнойный средний отит' },
  {
    code: 'H66.1',
    uz: 'Surunkali tubotimpanal yiringli oʻrta otit',
    ru: 'Хронический туботимпанальный гнойный средний отит',
  },
  {
    code: 'H66.2',
    uz: 'Surunkali epitimpano-antral yiringli oʻrta otit',
    ru: 'Хронический эпитимпано-антральный гнойный средний отит',
  },
  {
    code: 'H66.3',
    uz: 'Boshqa surunkali yiringli oʻrta otitlar',
    ru: 'Другие хронические гнойные средние отиты',
  },
  { code: 'H66.4', uz: 'Yiringli oʻrta otit, aniqlanmagan', ru: 'Гнойный средний отит неуточненный' },
  { code: 'H66.9', uz: 'Oʻrta otit, aniqlanmagan', ru: 'Средний отит неуточненный' },
  {
    code: 'H68.0',
    uz: 'Eshitish (Yevstaxiy) nayining yalligʻlanishi',
    ru: 'Воспаление слуховой [евстахиевой] трубы',
  },
  {
    code: 'H68.1',
    uz: 'Eshitish (Yevstaxiy) nayining tiqilishi',
    ru: 'Закупорка слуховой [евстахиевой] трубы',
  },
  { code: 'H69.0', uz: 'Ochiq (yopilmaydigan) eshitish nayi', ru: 'Зияющая слуховая [евстахиева] труба' },
  {
    code: 'H69.8',
    uz: 'Eshitish nayining boshqa aniqlangan kasalliklari',
    ru: 'Другие уточненные болезни слуховой [евстахиевой] трубы',
  },
  {
    code: 'H69.9',
    uz: 'Eshitish nayi kasalligi, aniqlanmagan',
    ru: 'Болезнь слуховой [евстахиевой] трубы неуточненная',
  },
  { code: 'H70.0', uz: 'Oʻtkir mastoidit', ru: 'Острый мастоидит' },
  { code: 'H70.1', uz: 'Surunkali mastoidit', ru: 'Хронический мастоидит' },
  { code: 'H70.2', uz: 'Petrozit', ru: 'Петрозит' },
  {
    code: 'H70.8',
    uz: 'Boshqa mastoiditlar va bogʻliq holatlar',
    ru: 'Другие мастоидиты и родственные состояния',
  },
  { code: 'H70.9', uz: 'Mastoidit, aniqlanmagan', ru: 'Мастоидит неуточненный' },
  { code: 'H71', uz: 'Oʻrta quloq xolesteatomasi', ru: 'Холестеатома среднего уха' },
  {
    code: 'H72.0',
    uz: 'Nogʻora pardaning markaziy perforatsiyasi',
    ru: 'Центральная перфорация барабанной перепонки',
  },
  {
    code: 'H72.1',
    uz: 'Nogʻora pardaning attik perforatsiyasi',
    ru: 'Перфорация барабанной перепонки в области аттика',
  },
  {
    code: 'H72.2',
    uz: 'Nogʻora pardaning boshqa chekka perforatsiyalari',
    ru: 'Другие краевые перфорации барабанной перепонки',
  },
  {
    code: 'H72.8',
    uz: 'Nogʻora pardaning boshqa perforatsiyalari',
    ru: 'Другие перфорации барабанной перепонки',
  },
  {
    code: 'H72.9',
    uz: 'Nogʻora parda perforatsiyasi, aniqlanmagan',
    ru: 'Перфорация барабанной перепонки неуточненная',
  },
  { code: 'H73.0', uz: 'Oʻtkir miringit', ru: 'Острый мирингит' },
  { code: 'H73.1', uz: 'Surunkali miringit', ru: 'Хронический мирингит' },
  {
    code: 'H73.8',
    uz: 'Nogʻora pardaning boshqa aniqlangan kasalliklari',
    ru: 'Другие уточненные болезни барабанной перепонки',
  },
  {
    code: 'H73.9',
    uz: 'Nogʻora parda kasalligi, aniqlanmagan',
    ru: 'Болезнь барабанной перепонки неуточненная',
  },
  { code: 'H74.0', uz: 'Timpanoskleroz', ru: 'Тимпаносклероз' },
  { code: 'H74.1', uz: 'Oʻrta quloqning adgeziv kasalligi', ru: 'Адгезивная болезнь среднего уха' },
  {
    code: 'H74.2',
    uz: 'Eshitish suyakchalarining uzilishi va dislokatsiyasi',
    ru: 'Разрыв и дислокация слуховых косточек',
  },
  {
    code: 'H74.3',
    uz: 'Eshitish suyakchalarining boshqa orttirilgan nuqsonlari',
    ru: 'Другие приобретенные дефекты слуховых косточек',
  },
  { code: 'H74.4', uz: 'Oʻrta quloq polipi', ru: 'Полип среднего уха' },
  {
    code: 'H74.8',
    uz: 'Oʻrta quloq va soʻrgʻichsimon oʻsiqning boshqa aniqlangan kasalliklari',
    ru: 'Другие уточненные болезни среднего уха и сосцевидного отростка',
  },
  {
    code: 'H74.9',
    uz: 'Oʻrta quloq va soʻrgʻichsimon oʻsiq kasalligi, aniqlanmagan',
    ru: 'Болезнь среднего уха и сосцевидного отростка неуточненная',
  },

  // ───────────── H80–H83: Ichki quloq ─────────────
  {
    code: 'H80.0',
    uz: 'Oval oynani qamragan otoskleroz, obliteratsiyasiz',
    ru: 'Отосклероз, вовлекающий овальное окно, необлитерирующий',
  },
  {
    code: 'H80.1',
    uz: 'Oval oynani qamragan otoskleroz, obliteratsiyali',
    ru: 'Отосклероз, вовлекающий овальное окно, облитерирующий',
  },
  { code: 'H80.2', uz: 'Koxlear otoskleroz', ru: 'Кохлеарный отосклероз' },
  { code: 'H80.8', uz: 'Otosklerozning boshqa shakllari', ru: 'Другие формы отосклероза' },
  { code: 'H80.9', uz: 'Otoskleroz, aniqlanmagan', ru: 'Отосклероз неуточненный' },
  { code: 'H81.0', uz: 'Menyer kasalligi', ru: 'Болезнь Меньера' },
  {
    code: 'H81.1',
    uz: 'Xavfsiz paroksizmal bosh aylanishi',
    ru: 'Доброкачественное пароксизмальное головокружение',
  },
  { code: 'H81.2', uz: 'Vestibulyar neyronit', ru: 'Вестибулярный нейронит' },
  { code: 'H81.3', uz: 'Boshqa periferik bosh aylanishlari', ru: 'Другие периферические головокружения' },
  {
    code: 'H81.4',
    uz: 'Markaziy kelib chiqishli bosh aylanishi',
    ru: 'Головокружение центрального происхождения',
  },
  {
    code: 'H81.8',
    uz: 'Vestibulyar funksiyaning boshqa buzilishlari',
    ru: 'Другие нарушения вестибулярной функции',
  },
  {
    code: 'H81.9',
    uz: 'Vestibulyar funksiya buzilishi, aniqlanmagan',
    ru: 'Нарушение вестибулярной функции неуточненное',
  },
  { code: 'H83.0', uz: 'Labirintit', ru: 'Лабиринтит' },
  { code: 'H83.1', uz: 'Labirint fistulasi', ru: 'Лабиринтная фистула' },
  { code: 'H83.2', uz: 'Labirint disfunksiyasi', ru: 'Лабиринтная дисфункция' },
  { code: 'H83.3', uz: 'Ichki quloqqa shovqin taʼsiri', ru: 'Шумовые эффекты внутреннего уха' },
  {
    code: 'H83.8',
    uz: 'Ichki quloqning boshqa aniqlangan kasalliklari',
    ru: 'Другие уточненные болезни внутреннего уха',
  },
  { code: 'H83.9', uz: 'Ichki quloq kasalligi, aniqlanmagan', ru: 'Болезнь внутреннего уха неуточненная' },

  // ───────────── H90–H95: Eshitish pasayishi va boshqa quloq kasalliklari ─────────────
  {
    code: 'H90.0',
    uz: 'Ikki tomonlama konduktiv eshitish pasayishi',
    ru: 'Кондуктивная потеря слуха двусторонняя',
  },
  {
    code: 'H90.1',
    uz: 'Bir tomonlama konduktiv eshitish pasayishi (qarama-qarshi quloq eshitishi normal)',
    ru: 'Кондуктивная потеря слуха односторонняя с нормальным слухом на противоположном ухе',
  },
  {
    code: 'H90.2',
    uz: 'Konduktiv eshitish pasayishi, aniqlanmagan',
    ru: 'Кондуктивная потеря слуха неуточненная',
  },
  {
    code: 'H90.3',
    uz: 'Ikki tomonlama neyrosensor eshitish pasayishi',
    ru: 'Нейросенсорная потеря слуха двусторонняя',
  },
  {
    code: 'H90.4',
    uz: 'Bir tomonlama neyrosensor eshitish pasayishi (qarama-qarshi quloq eshitishi normal)',
    ru: 'Нейросенсорная потеря слуха односторонняя с нормальным слухом на противоположном ухе',
  },
  {
    code: 'H90.5',
    uz: 'Neyrosensor eshitish pasayishi, aniqlanmagan',
    ru: 'Нейросенсорная потеря слуха неуточненная',
  },
  {
    code: 'H90.6',
    uz: 'Ikki tomonlama aralash konduktiv va neyrosensor eshitish pasayishi',
    ru: 'Смешанная кондуктивная и нейросенсорная потеря слуха двусторонняя',
  },
  {
    code: 'H90.7',
    uz: 'Bir tomonlama aralash konduktiv va neyrosensor eshitish pasayishi',
    ru: 'Смешанная кондуктивная и нейросенсорная потеря слуха односторонняя с нормальным слухом на противоположном ухе',
  },
  {
    code: 'H90.8',
    uz: 'Aralash konduktiv va neyrosensor eshitish pasayishi, aniqlanmagan',
    ru: 'Смешанная кондуктивная и нейросенсорная потеря слуха неуточненная',
  },
  { code: 'H91.0', uz: 'Ototoksik eshitish pasayishi', ru: 'Ототоксическая потеря слуха' },
  { code: 'H91.1', uz: 'Presbiakuzis (yoshga oid eshitish pasayishi)', ru: 'Пресбиакузис' },
  {
    code: 'H91.2',
    uz: 'Toʻsatdan idiopatik eshitish pasayishi',
    ru: 'Внезапная идиопатическая потеря слуха',
  },
  {
    code: 'H91.3',
    uz: 'Kar-soqovlik, boshqa rubrikalarda tasniflanmagan',
    ru: 'Глухонемота, не классифицированная в других рубриках',
  },
  { code: 'H91.8', uz: 'Boshqa aniqlangan eshitish pasayishlari', ru: 'Другие уточненные потери слуха' },
  { code: 'H91.9', uz: 'Eshitish pasayishi, aniqlanmagan', ru: 'Потеря слуха неуточненная' },
  { code: 'H92.0', uz: 'Otalgiya (quloq ogʻrigʻi)', ru: 'Оталгия' },
  { code: 'H92.1', uz: 'Otoreya (quloqdan ajralma)', ru: 'Оторея' },
  { code: 'H92.2', uz: 'Otorragiya (quloqdan qon ketishi)', ru: 'Оторрагия' },
  {
    code: 'H93.0',
    uz: 'Quloqning degenerativ va tomir kasalliklari',
    ru: 'Дегенеративные и сосудистые болезни уха',
  },
  { code: 'H93.1', uz: 'Quloqdagi shovqin (tinnitus)', ru: 'Шум в ушах (субъективный)' },
  {
    code: 'H93.2',
    uz: 'Eshitish idrokining boshqa anomaliyalari',
    ru: 'Другие аномалии слухового восприятия',
  },
  { code: 'H93.3', uz: 'Eshitish nervi kasalliklari', ru: 'Болезни слухового нерва' },
  { code: 'H93.8', uz: 'Quloqning boshqa aniqlangan kasalliklari', ru: 'Другие уточненные болезни уха' },
  { code: 'H93.9', uz: 'Quloq kasalligi, aniqlanmagan', ru: 'Болезнь уха неуточненная' },
  {
    code: 'H95.0',
    uz: 'Mastoidektomiyadan keyingi boʻshliqning qaytalanuvchi xolesteatomasi',
    ru: 'Рецидивирующая холестеатома полости после мастоидэктомии',
  },
  {
    code: 'H95.1',
    uz: 'Mastoidektomiyadan keyingi boshqa buzilishlar',
    ru: 'Другие нарушения после мастоидэктомии',
  },
  {
    code: 'H95.8',
    uz: 'Tibbiy muolajalardan keyingi quloq va soʻrgʻichsimon oʻsiqning boshqa shikastlanishlari',
    ru: 'Другие поражения уха и сосцевидного отростка после медицинских процедур',
  },
  {
    code: 'H95.9',
    uz: 'Tibbiy muolajalardan keyingi quloq va soʻrgʻichsimon oʻsiq shikastlanishi, aniqlanmagan',
    ru: 'Поражение уха и сосцевидного отростка после медицинских процедур неуточненное',
  },

  // ───────────── J00–J06: Yuqori nafas yoʻllarining oʻtkir infeksiyalari ─────────────
  { code: 'J00', uz: 'Oʻtkir nazofaringit (tumov)', ru: 'Острый назофарингит (насморк)' },
  {
    code: 'J01.0',
    uz: 'Oʻtkir yuqori jagʻ (gaymor) sinusiti',
    ru: 'Острый верхнечелюстной синусит (гайморит)',
  },
  { code: 'J01.1', uz: 'Oʻtkir frontal sinusit', ru: 'Острый фронтальный синусит (фронтит)' },
  { code: 'J01.2', uz: 'Oʻtkir etmoidal sinusit', ru: 'Острый этмоидальный синусит (этмоидит)' },
  { code: 'J01.3', uz: 'Oʻtkir sfenoidal sinusit', ru: 'Острый сфеноидальный синусит (сфеноидит)' },
  { code: 'J01.4', uz: 'Oʻtkir pansinusit', ru: 'Острый пансинусит' },
  { code: 'J01.8', uz: 'Boshqa oʻtkir sinusit', ru: 'Другой острый синусит' },
  { code: 'J01.9', uz: 'Oʻtkir sinusit, aniqlanmagan', ru: 'Острый синусит неуточненный' },
  { code: 'J02.0', uz: 'Streptokokkli faringit', ru: 'Стрептококковый фарингит' },
  {
    code: 'J02.8',
    uz: 'Boshqa aniqlangan qoʻzgʻatuvchilar keltirib chiqargan oʻtkir faringit',
    ru: 'Острый фарингит, вызванный другими уточненными возбудителями',
  },
  { code: 'J02.9', uz: 'Oʻtkir faringit, aniqlanmagan', ru: 'Острый фарингит неуточненный' },
  { code: 'J03.0', uz: 'Streptokokkli tonzillit', ru: 'Стрептококковый тонзиллит' },
  {
    code: 'J03.8',
    uz: 'Boshqa aniqlangan qoʻzgʻatuvchilar keltirib chiqargan oʻtkir tonzillit',
    ru: 'Острый тонзиллит, вызванный другими уточненными возбудителями',
  },
  { code: 'J03.9', uz: 'Oʻtkir tonzillit (angina), aniqlanmagan', ru: 'Острый тонзиллит неуточненный' },
  { code: 'J04.0', uz: 'Oʻtkir laringit', ru: 'Острый ларингит' },
  { code: 'J04.1', uz: 'Oʻtkir traxeit', ru: 'Острый трахеит' },
  { code: 'J04.2', uz: 'Oʻtkir laringotraxeit', ru: 'Острый ларинготрахеит' },
  { code: 'J05.0', uz: 'Oʻtkir obstruktiv laringit (krup)', ru: 'Острый обструктивный ларингит [круп]' },
  { code: 'J05.1', uz: 'Oʻtkir epiglottit', ru: 'Острый эпиглоттит' },
  { code: 'J06.0', uz: 'Oʻtkir laringofaringit', ru: 'Острый ларингофарингит' },
  {
    code: 'J06.8',
    uz: 'Yuqori nafas yoʻllarining koʻp joyli boshqa oʻtkir infeksiyalari',
    ru: 'Другие острые инфекции верхних дыхательных путей множественной локализации',
  },
  {
    code: 'J06.9',
    uz: 'Yuqori nafas yoʻllarining oʻtkir infeksiyasi, aniqlanmagan',
    ru: 'Острая инфекция верхних дыхательных путей неуточненная',
  },

  // ───────────── J30–J39: Yuqori nafas yoʻllarining boshqa kasalliklari ─────────────
  { code: 'J30.0', uz: 'Vazomotor rinit', ru: 'Вазомоторный ринит' },
  {
    code: 'J30.1',
    uz: 'Oʻsimlik changi keltirib chiqargan allergik rinit',
    ru: 'Аллергический ринит, вызванный пыльцой растений',
  },
  { code: 'J30.2', uz: 'Boshqa mavsumiy allergik rinitlar', ru: 'Другие сезонные аллергические риниты' },
  { code: 'J30.3', uz: 'Boshqa allergik rinitlar', ru: 'Другие аллергические риниты' },
  { code: 'J30.4', uz: 'Allergik rinit, aniqlanmagan', ru: 'Аллергический ринит неуточненный' },
  { code: 'J31.0', uz: 'Surunkali rinit', ru: 'Хронический ринит' },
  { code: 'J31.1', uz: 'Surunkali nazofaringit', ru: 'Хронический назофарингит' },
  { code: 'J31.2', uz: 'Surunkali faringit', ru: 'Хронический фарингит' },
  {
    code: 'J32.0',
    uz: 'Surunkali yuqori jagʻ (gaymor) sinusiti',
    ru: 'Хронический верхнечелюстной синусит (гайморит)',
  },
  { code: 'J32.1', uz: 'Surunkali frontal sinusit', ru: 'Хронический фронтальный синусит (фронтит)' },
  { code: 'J32.2', uz: 'Surunkali etmoidal sinusit', ru: 'Хронический этмоидальный синусит (этмоидит)' },
  { code: 'J32.3', uz: 'Surunkali sfenoidal sinusit', ru: 'Хронический сфеноидальный синусит (сфеноидит)' },
  { code: 'J32.4', uz: 'Surunkali pansinusit', ru: 'Хронический пансинусит' },
  { code: 'J32.8', uz: 'Boshqa surunkali sinusitlar', ru: 'Другие хронические синуситы' },
  { code: 'J32.9', uz: 'Surunkali sinusit, aniqlanmagan', ru: 'Хронический синусит неуточненный' },
  { code: 'J33.0', uz: 'Burun boʻshligʻi polipi', ru: 'Полип полости носа' },
  { code: 'J33.1', uz: 'Sinusning polipoz degeneratsiyasi', ru: 'Полипозная дегенерация синуса' },
  { code: 'J33.8', uz: 'Sinusning boshqa poliplari', ru: 'Другие полипы синуса' },
  { code: 'J33.9', uz: 'Burun polipi, aniqlanmagan', ru: 'Полип носа неуточненный' },
  { code: 'J34.0', uz: 'Burun abssessi, furunkuli va karbunkuli', ru: 'Абсцесс, фурункул и карбункул носа' },
  {
    code: 'J34.1',
    uz: 'Burun va burun sinusining kistasi va mukotselesi',
    ru: 'Киста или мукоцеле носового синуса',
  },
  { code: 'J34.2', uz: 'Burun toʻsigʻining qiyshayishi', ru: 'Смещенная носовая перегородка' },
  { code: 'J34.3', uz: 'Burun chigʻanoqlari gipertrofiyasi', ru: 'Гипертрофия носовых раковин' },
  {
    code: 'J34.8',
    uz: 'Burun va burun sinuslarining boshqa aniqlangan kasalliklari',
    ru: 'Другие уточненные болезни носа и носовых синусов',
  },
  { code: 'J35.0', uz: 'Surunkali tonzillit', ru: 'Хронический тонзиллит' },
  { code: 'J35.1', uz: 'Murtaklar (bodomchalar) gipertrofiyasi', ru: 'Гипертрофия миндалин' },
  { code: 'J35.2', uz: 'Adenoidlar gipertrofiyasi', ru: 'Гипертрофия аденоидов' },
  {
    code: 'J35.3',
    uz: 'Murtaklar va adenoidlar gipertrofiyasi',
    ru: 'Гипертрофия миндалин с гипертрофией аденоидов',
  },
  {
    code: 'J35.8',
    uz: 'Murtaklar va adenoidlarning boshqa surunkali kasalliklari',
    ru: 'Другие хронические болезни миндалин и аденоидов',
  },
  {
    code: 'J35.9',
    uz: 'Murtaklar va adenoidlarning surunkali kasalligi, aniqlanmagan',
    ru: 'Хроническая болезнь миндалин и аденоидов неуточненная',
  },
  { code: 'J36', uz: 'Paratonzillyar abssess', ru: 'Перитонзиллярный абсцесс' },
  { code: 'J37.0', uz: 'Surunkali laringit', ru: 'Хронический ларингит' },
  { code: 'J37.1', uz: 'Surunkali laringotraxeit', ru: 'Хронический ларинготрахеит' },
  { code: 'J38.0', uz: 'Ovoz boylamlari va hiqildoq falaji', ru: 'Паралич голосовых складок и гортани' },
  { code: 'J38.1', uz: 'Ovoz boylami va hiqildoq polipi', ru: 'Полип голосовой складки и гортани' },
  { code: 'J38.2', uz: 'Ovoz boylamlari tugunchalari', ru: 'Узелки голосовых складок' },
  { code: 'J38.3', uz: 'Ovoz boylamlarining boshqa kasalliklari', ru: 'Другие болезни голосовых складок' },
  { code: 'J38.4', uz: 'Hiqildoq shishi', ru: 'Отек гортани' },
  { code: 'J38.5', uz: 'Hiqildoq spazmi', ru: 'Спазм гортани' },
  { code: 'J38.6', uz: 'Hiqildoq stenozi', ru: 'Стеноз гортани' },
  { code: 'J38.7', uz: 'Hiqildoqning boshqa kasalliklari', ru: 'Другие болезни гортани' },
  {
    code: 'J39.0',
    uz: 'Retrofaringeal va parafaringeal abssess',
    ru: 'Ретрофарингеальный и парафарингеальный абсцесс',
  },
  { code: 'J39.1', uz: 'Halqumning boshqa abssessi', ru: 'Другой абсцесс глотки' },
  { code: 'J39.2', uz: 'Halqumning boshqa kasalliklari', ru: 'Другие болезни глотки' },
  {
    code: 'J39.3',
    uz: 'Yuqori nafas yoʻllarining yuqori sezuvchanlik reaksiyasi, joyi aniqlanmagan',
    ru: 'Реакция повышенной чувствительности верхних дыхательных путей, локализация неуточненная',
  },
  {
    code: 'J39.8',
    uz: 'Yuqori nafas yoʻllarining boshqa aniqlangan kasalliklari',
    ru: 'Другие уточненные болезни верхних дыхательных путей',
  },
  {
    code: 'J39.9',
    uz: 'Yuqori nafas yoʻllari kasalligi, aniqlanmagan',
    ru: 'Болезнь верхних дыхательных путей неуточненная',
  },

  // ───────────── LOR amaliyotida uchraydigan boshqa kodlar ─────────────
  { code: 'R04.0', uz: 'Burundan qon ketishi (epistaksis)', ru: 'Носовое кровотечение' },
  { code: 'R06.5', uz: 'Ogʻiz orqali nafas olish', ru: 'Дыхание через рот' },
  { code: 'R43.0', uz: 'Anosmiya (hid bilmaslik)', ru: 'Аносмия' },
  { code: 'R49.0', uz: 'Disfoniya (ovoz boʻgʻilishi)', ru: 'Дисфония' },
  { code: 'R49.1', uz: 'Afoniya (ovoz yoʻqolishi)', ru: 'Афония' },
  { code: 'G47.3', uz: 'Uyqudagi apnoe', ru: 'Апноэ во сне' },
  { code: 'T16', uz: 'Quloqdagi yot jism', ru: 'Инородное тело в ухе' },
  { code: 'T17.0', uz: 'Burun sinusidagi yot jism', ru: 'Инородное тело в носовом синусе' },
  { code: 'T17.1', uz: 'Burun yoʻlidagi yot jism', ru: 'Инородное тело в носовом ходе' },
  { code: 'T17.2', uz: 'Halqumdagi yot jism', ru: 'Инородное тело в глотке' },
  { code: 'T17.3', uz: 'Hiqildoqdagi yot jism', ru: 'Инородное тело в гортани' },
];

/** Kod boʻyicha tez qidiruv (H66.0 → yozuv) */
const BY_CODE: ReadonlyMap<string, Icd10Entry> = new Map(ICD10_LOR.map((e) => [e.code, e]));

export function findIcd10(code: string | null | undefined): Icd10Entry | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.trim().toUpperCase());
}

/** Joriy tildagi nom */
export function icd10Title(entry: Icd10Entry, locale: Locale): string {
  return locale === 'ru' ? entry.ru : entry.uz;
}

/** "H66.0 — Oʻtkir yiringli oʻrta otit" */
export function icd10Label(entry: Icd10Entry, locale: Locale): string {
  return `${entry.code} — ${icd10Title(entry, locale)}`;
}

/**
 * Qidiruv: kod prefiksi (H66, j01.0), nom boʻlagi (ikkala tilda). Natija reytingi:
 *   0 — kod aynan mos, 1 — kod shu bilan boshlanadi, 2 — nom shu bilan boshlanadi, 3 — nom ichida uchraydi.
 * `q` boʻsh boʻlsa roʻyxat boshidan `limit` ta yozuv qaytadi.
 */
export function searchIcd10(q: string, locale: Locale = 'uz', limit = 20): Icd10Entry[] {
  const max = Math.max(1, Math.min(200, Math.floor(limit)));
  const query = normalizeSearch(q ?? '');
  if (!query) return ICD10_LOR.slice(0, max);

  const codeQuery = query.replace(/\s+/g, '').toUpperCase();
  const primary = locale === 'ru' ? 'ru' : 'uz';
  const secondary = primary === 'ru' ? 'uz' : 'ru';

  const scored: Array<{ entry: Icd10Entry; rank: number; index: number }> = [];
  ICD10_LOR.forEach((entry, index) => {
    const code = entry.code.toUpperCase();
    const title = normalizeSearch(entry[primary]);
    const alt = normalizeSearch(entry[secondary]);
    let rank = -1;
    if (code === codeQuery) rank = 0;
    else if (code.startsWith(codeQuery)) rank = 1;
    else if (title.startsWith(query)) rank = 2;
    else if (title.includes(query) || alt.includes(query)) rank = 3;
    else if (query.split(' ').every((w) => title.includes(w))) rank = 4;
    if (rank >= 0) scored.push({ entry, rank, index });
  });

  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return scored.slice(0, max).map((s) => s.entry);
}
