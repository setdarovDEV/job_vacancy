import {
  Briefcase, Building2, Camera, Code, Ellipsis, Factory, GraduationCap, HardHat, House, Landmark, Megaphone,
  Scale, Scissors, Shield, ShoppingBag, Sprout, Stethoscope, Truck, Users, Utensils, type LucideIcon,
} from "lucide-react";

// The catalog names a lucide icon per root category. A static map (not a dynamic import of the
// whole icon set) keeps the home chunk small; unknown names fall back to a briefcase.
const icons: Record<string, LucideIcon> = {
  code: Code, "shopping-bag": ShoppingBag, megaphone: Megaphone, landmark: Landmark,
  "graduation-cap": GraduationCap, stethoscope: Stethoscope, "hard-hat": HardHat, factory: Factory,
  truck: Truck, utensils: Utensils, scissors: Scissors, briefcase: Briefcase, users: Users, scale: Scale,
  shield: Shield, home: House, sprout: Sprout, "building-2": Building2, camera: Camera, ellipsis: Ellipsis,
};

export function categoryIcon(name: string | undefined): LucideIcon {
  return (name && icons[name]) || Briefcase;
}
