import { OwnerPlan } from "./plans";

export function getPlanRankBoost(plan: OwnerPlan) {
  if (plan === "premium") return 30;
  if (plan === "pro") return 10;
  return 0;
}

export function getOwnerBadge(plan: OwnerPlan) {
  if (plan === "premium") return "Premium Owner";
  if (plan === "pro") return "Pro Owner";
  return null;
}