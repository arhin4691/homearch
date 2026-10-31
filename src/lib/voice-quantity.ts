const digits: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };

export function parseSpokenQuantity(source: string): number | null {
  source = source.replace(/(?:隻|只|支|個|个|瓶|盒|包|件|杯|罐|條|条|袋|片|顆|颗|粒|桶|塊|块|枚|份|升|毫升|公斤|克)$/, "");
  if (source === "半打") return 6;
  const dozen = source.endsWith("打");
  let number = dozen ? source.slice(0, -1) : source;
  number = number.replace(/廿/g, "二十").replace(/卅/g, "三十");
  if (/^\d+$/.test(number)) {
    const result = Number(number) * (dozen ? 12 : 1);
    return Number.isSafeInteger(result) && result > 0 && result <= 100000 ? result : null;
  }
  if (!number || !/^[零〇一二兩三四五六七八九十百千]+$/.test(number)) return null;
  let total = 0;
  let current = 0;
  let lastUnit = 10000;
  for (const character of number) {
    if (Object.hasOwn(digits, character)) {
      current = current * 10 + digits[character];
    } else {
      const unit = units[character];
      if (unit >= lastUnit) return null;
      total += (current || 1) * unit;
      current = 0;
      lastUnit = unit;
    }
  }
  const result = (total + current) * (dozen ? 12 : 1);
  return Number.isSafeInteger(result) && result > 0 && result <= 100000 ? result : null;
}
