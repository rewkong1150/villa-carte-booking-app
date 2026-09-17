// Shared fixed department list used by both the login form and the booking form,
// so admin analytics (bookings-by-department) aren't fragmented by free-text typos.
// The English string is always the value stored on records/filters — only the
// on-screen label changes with the active language.
export const DEPARTMENT_OPTIONS = [
  'Purchasing Department',
  'Legal',
  'Construction',
  'Design',
  'Community',
  'Landscape',
  'Marketing Department',
  'Information Technology',
  'Human Resources',
  'Executive Management',
  'Accounting & Financial',
];

type AppLanguage = 'th' | 'en' | 'ru';

const DEPARTMENT_LABELS: Record<Exclude<AppLanguage, 'en'>, Record<string, string>> = {
  th: {
    'Purchasing Department': 'ฝ่ายจัดซื้อ',
    Legal: 'ฝ่ายกฎหมาย',
    Construction: 'ฝ่ายก่อสร้าง',
    Design: 'ฝ่ายออกแบบ',
    Community: 'ฝ่ายชุมชนสัมพันธ์',
    Landscape: 'ฝ่ายภูมิสถาปัตยกรรม',
    'Marketing Department': 'ฝ่ายการตลาด',
    'Information Technology': 'ฝ่ายเทคโนโลยีสารสนเทศ',
    'Human Resources': 'ฝ่ายทรัพยากรบุคคล',
    'Executive Management': 'ผู้บริหาร',
    'Accounting & Financial': 'ฝ่ายบัญชีและการเงิน',
  },
  ru: {
    'Purchasing Department': 'Отдел закупок',
    Legal: 'Юридический отдел',
    Construction: 'Отдел строительства',
    Design: 'Отдел дизайна',
    Community: 'Отдел по работе с сообществом',
    Landscape: 'Отдел ландшафтного дизайна',
    'Marketing Department': 'Отдел маркетинга',
    'Information Technology': 'Отдел информационных технологий',
    'Human Resources': 'Отдел кадров',
    'Executive Management': 'Руководство',
    'Accounting & Financial': 'Бухгалтерия и финансы',
  },
};

/** English department value is what's stored everywhere — this only translates the display label. */
export const getDepartmentLabel = (department: string, lang: AppLanguage): string => {
  if (lang === 'en') return department;
  return DEPARTMENT_LABELS[lang][department] || department;
};
