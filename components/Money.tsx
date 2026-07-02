"use client";

import { formatMoney } from "@/lib/currency";
import { usePreferences } from "@/components/preferences/PreferencesProvider";
import type { CurrencyCode } from "@/lib/currency";

type MoneyProps = {
  amountCAD: number | null | undefined;
  className?: string;
};

export default function Money({ amountCAD, className }: MoneyProps) {
  const { currency, convertFromCAD } = usePreferences();

  if (amountCAD == null) return null;

  const converted = convertFromCAD(Number(amountCAD));

  if (!Number.isFinite(converted)) return null;

  return (
    <span className={className}>
      {formatMoney(converted, currency as CurrencyCode)}
    </span>
  );
}
