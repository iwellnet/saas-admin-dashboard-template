import { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ScrollText,
  UserCog,
  LogOut,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { dashboardConfig } from "@/config";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  ownerOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "Обзор", icon: <LayoutDashboard className="w-4 h-4" /> },
  { to: "/orgs", label: "Организации", icon: <Building2 className="w-4 h-4" /> },
  { to: "/payments", label: "Платежи", icon: <CreditCard className="w-4 h-4" /> },
  { to: "/audit", label: "Audit log", icon: <ScrollText className="w-4 h-4" /> },
  { to: "/admins", label: "Super-admins", icon: <UserCog className="w-4 h-4" />, ownerOnly: true },
];

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const visibleItems = navItems.filter((i) => !i.ownerOnly || profile?.role === "owner");

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="w-60 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Shield className="w-5 h-5 text-primary" />
            <span className="truncate">{dashboardConfig.saasName}</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">Admin panel</p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t space-y-2">
          <div className="px-2 text-sm">
            <div className="font-medium truncate">{profile?.full_name || profile?.email}</div>
            <div className="text-xs text-muted-foreground capitalize">{profile?.role}</div>
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="w-4 h-4" />
            Выход
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
