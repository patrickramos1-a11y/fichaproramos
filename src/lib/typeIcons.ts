import {
  Layers, Leaf, Droplet, FileText, MapPin, Factory, FlaskConical, TreePine,
  Building2, Wrench, ClipboardCheck, Mountain, Sun, Wind, Recycle, Beaker,
  ShieldCheck, Compass, Truck, Zap, Activity, Gauge, Microscope, Sprout,
  type LucideIcon,
} from "lucide-react";

export const TYPE_ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: "Layers", icon: Layers },
  { name: "Leaf", icon: Leaf },
  { name: "Droplet", icon: Droplet },
  { name: "FileText", icon: FileText },
  { name: "MapPin", icon: MapPin },
  { name: "Factory", icon: Factory },
  { name: "FlaskConical", icon: FlaskConical },
  { name: "TreePine", icon: TreePine },
  { name: "Building2", icon: Building2 },
  { name: "Wrench", icon: Wrench },
  { name: "ClipboardCheck", icon: ClipboardCheck },
  { name: "Mountain", icon: Mountain },
  { name: "Sun", icon: Sun },
  { name: "Wind", icon: Wind },
  { name: "Recycle", icon: Recycle },
  { name: "Beaker", icon: Beaker },
  { name: "ShieldCheck", icon: ShieldCheck },
  { name: "Compass", icon: Compass },
  { name: "Truck", icon: Truck },
  { name: "Zap", icon: Zap },
  { name: "Activity", icon: Activity },
  { name: "Gauge", icon: Gauge },
  { name: "Microscope", icon: Microscope },
  { name: "Sprout", icon: Sprout },
];

const MAP: Record<string, LucideIcon> = Object.fromEntries(
  TYPE_ICON_OPTIONS.map((o) => [o.name, o.icon]),
);

export function getTypeIcon(name?: string): LucideIcon {
  return (name && MAP[name]) || Layers;
}

export const DEFAULT_BUILTIN_ICONS: Record<string, string> = {
  geral: "Layers",
  ambiental: "Leaf",
  vazao: "Droplet",
  outorga: "FileText",
  terreno: "MapPin",
};
