import { getOwnerBadgeLabel, getPlanEntitlements, type OwnerPlan } from "./plans";

export function getPlanRankBoost(plan: OwnerPlan) {
  return getPlanEntitlements(plan).searchWeight * 10;
}

export function getOwnerBadge(plan: OwnerPlan) {
  return getOwnerBadgeLabel(plan);
}
