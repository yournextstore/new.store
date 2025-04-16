import { getMultiplierForCurrency } from "@/lib/currencies";
import { sql } from "drizzle-orm";

export const dbMoneyInt = (currency: string, price: string | bigint) => {
	const multiplier = getMultiplierForCurrency(currency);
	return sql<bigint>`cast(round(cast(${price} as numeric) * ${multiplier}) as bigint)`;
};

export const PERCENT_PRECISION = 1000n;

export const dbPercentInt = (price: string | bigint) => {
	const multiplier = Number(PERCENT_PRECISION);
	return sql<bigint>`cast(round(cast(${price} as numeric) * ${multiplier}) as bigint)`;
};
