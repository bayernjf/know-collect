/**
 * 按浏览器本地时区格式化为 `YYYY-MM-DD`。
 *
 * 不要用 `toISOString().slice(0, 10)`：那是 UTC 日期，在 UTC+8 等正偏移时区会
 * 把本地零点算成前一天，热力图等按“天”分组的界面会整体偏移一格。
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
