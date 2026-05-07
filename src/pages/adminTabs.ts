import {
  Activity,
  Award,
  BarChart3,
  Handshake,
  Heart,
  History,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Tag,
  Tags,
  Ticket,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Tab =
  | "dashboard"
  | "funnel"
  | "wishlist"
  | "reports"
  | "products"
  | "categories"
  | "brands"
  | "promotions"
  | "orders"
  | "coupons"
  | "shipping"
  | "users"
  | "affiliates"
  | "settings"
  | "diagnostics"
  | "audit";

export type TabDefinition = { id: Tab; label: string; icon: LucideIcon };
export type GroupDefinition = { id: string; label: string; icon: LucideIcon; tabs: Tab[] };

export const TAB_IDS: Tab[] = [
  "dashboard",
  "funnel",
  "wishlist",
  "reports",
  "products",
  "categories",
  "brands",
  "promotions",
  "orders",
  "coupons",
  "shipping",
  "users",
  "affiliates",
  "settings",
  "diagnostics",
  "audit",
];

export const TABS: TabDefinition[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "funnel", label: "Funil", icon: TrendingUp },
  { id: "wishlist", label: "Favoritos", icon: Heart },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
  { id: "products", label: "Produtos", icon: Package },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "brands", label: "Marcas", icon: Award },
  { id: "promotions", label: "Promoções", icon: Tag },
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "coupons", label: "Cupons", icon: Ticket },
  { id: "shipping", label: "Fretes", icon: Truck },
  { id: "users", label: "Usuários", icon: Users },
  { id: "affiliates", label: "Afiliados", icon: Handshake },
  { id: "settings", label: "Configurações", icon: Settings },
  { id: "diagnostics", label: "Diagnóstico", icon: Activity },
  { id: "audit", label: "Histórico", icon: History },
];

export const GROUPS: GroupDefinition[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard, tabs: ["dashboard", "funnel", "wishlist", "reports"] },
  { id: "catalog", label: "Catálogo", icon: Package, tabs: ["products", "categories", "brands", "promotions"] },
  { id: "sales", label: "Vendas", icon: ShoppingBag, tabs: ["orders", "coupons", "shipping"] },
  { id: "people", label: "Pessoas", icon: Users, tabs: ["users", "affiliates"] },
  { id: "system", label: "Sistema", icon: Settings, tabs: ["settings", "diagnostics", "audit"] },
];

export const TAB_TO_GROUP: Record<Tab, string> = (() => {
  const map = {} as Record<Tab, string>;
  for (const group of GROUPS) {
    for (const tab of group.tabs) map[tab] = group.id;
  }
  return map;
})();
