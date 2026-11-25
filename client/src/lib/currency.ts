import { formatMoney, Currency } from "@finance-buddy/shared";

export function formatCurrency(cents: number, currency: Currency = "INR"): string {
  return formatMoney(cents, currency);
}
