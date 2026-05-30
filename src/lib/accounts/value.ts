import { toBcp47 } from "@/i18n/locale";
import type { AccountValueType } from "./types";

/**
 * Account value formatting — the single canonical place that turns an account's
 * raw amount (`Account.mrr`) + `valueType` into a human-facing label, replacing
 * the three near-identical `formatMrr` helpers that used to live in the accounts
 * list, the detail header and the master-data card.
 *
 * Pure + isomorphic (no "server-only"): used by both server components (pages)
 * and client components (the editable cards). The per-period suffix itself is
 * i18n text, so this module does NOT translate — it formats the money and tells
 * the caller WHICH health.common key to render, and the caller (which already
 * holds a next-intl translator) interpolates the amount. That split keeps the
 * currency/locale logic centralized without coupling this file to a translator
 * type.
 */

/** Format just the money amount in the account's currency (no period suffix). */
export function formatAccountAmount(
  amount: number,
  currency: "USD" | "EUR",
  locale: string,
): string {
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * The `health.common` i18n key whose message renders the formatted amount with
 * the right period suffix (e.g. "{amount}/Monat", "{amount} einmalig"). Pass the
 * output of {@link formatAccountAmount} as the `amount` interpolation value:
 *
 *   t(accountValueKey(account.valueType), {
 *     amount: formatAccountAmount(account.mrr, account.currency, locale),
 *   })
 */
export function accountValueKey(
  valueType: AccountValueType,
): "valueMonthly" | "valueYearly" | "valueOneTime" {
  switch (valueType) {
    case "yearly":
      return "valueYearly";
    case "one_time":
      return "valueOneTime";
    default:
      return "valueMonthly";
  }
}

/**
 * The `health.common` i18n key for the BARE value-type label (no amount) — used
 * for the `<select>` options in the create/edit forms.
 */
export function accountValueTypeLabelKey(
  valueType: AccountValueType,
): "valueTypeMonthly" | "valueTypeYearly" | "valueTypeOneTime" {
  switch (valueType) {
    case "yearly":
      return "valueTypeYearly";
    case "one_time":
      return "valueTypeOneTime";
    default:
      return "valueTypeMonthly";
  }
}
