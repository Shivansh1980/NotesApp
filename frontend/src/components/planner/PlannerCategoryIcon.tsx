import {
  BookOpen,
  BriefcaseBusiness,
  Coffee,
  Dumbbell,
  Heart,
  MoonStar,
  Plane,
  Utensils
} from "lucide-react";

import type { PlannerCategory } from "../../types/planner.types";

export const PLANNER_CATEGORIES: Array<{ value: PlannerCategory; label: string }> = [
  { value: "work", label: "Work" },
  { value: "study", label: "Study" },
  { value: "gym", label: "Gym" },
  { value: "sleep", label: "Sleep" },
  { value: "travel", label: "Travel" },
  { value: "food", label: "Food" },
  { value: "personal", label: "Personal" },
  { value: "break", label: "Break" }
];

type PlannerCategoryIconProps = {
  category: string;
  size?: number;
};

export function PlannerCategoryIcon({ category, size = 18 }: PlannerCategoryIconProps) {
  const props = { size, strokeWidth: 1.8, "aria-hidden": true as const };
  if (category === "study") return <BookOpen {...props} />;
  if (category === "gym") return <Dumbbell {...props} />;
  if (category === "sleep") return <MoonStar {...props} />;
  if (category === "travel") return <Plane {...props} />;
  if (category === "food") return <Utensils {...props} />;
  if (category === "personal") return <Heart {...props} />;
  if (category === "break") return <Coffee {...props} />;
  return <BriefcaseBusiness {...props} />;
}

export function plannerCategoryLabel(category: string): string {
  return PLANNER_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}
