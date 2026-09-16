/**
 * SMS/Telegram shablonlarini toʻldirish: "{clinic}: {name}, {date} {time}" → haqiqiy qiymatlar.
 * Nomaʼlum kalitlar oʻzgarmasdan qoladi. Kichik va mustaqil (settings modulidan import qilinmaydi).
 */
export type TemplateVars = Record<string, string | number | undefined>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = vars[key];
    return v === undefined ? match : String(v);
  });
}
