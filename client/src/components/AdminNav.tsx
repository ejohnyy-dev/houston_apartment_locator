import { Link } from "wouter";
import { Building2, Users, BarChart3, Home, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNavProps {
  active: "listings" | "nurture" | "reports" | "rentcast";
}

const navItems = [
  {
    key: "listings" as const,
    label: "Listings",
    href: "/admin/listings",
    icon: Building2,
  },
  {
    key: "nurture" as const,
    label: "Lead Nurture",
    href: "/admin/nurture",
    icon: Users,
  },
  {
    key: "reports" as const,
    label: "Reports",
    href: "/admin/reports",
    icon: BarChart3,
  },
  {
    key: "rentcast" as const,
    label: "RentCast",
    href: "/admin/rentcast",
    icon: Database,
  },
];

export default function AdminNav({ active }: AdminNavProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-6 h-14">
          {/* Back to site */}
          <Link href="/">
            <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer mr-2">
              <Home className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:block">Site</span>
            </div>
          </Link>

          <span className="text-slate-200 text-sm">|</span>

          {/* Admin label */}
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:block">
            Admin
          </span>

          {/* Nav items */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ key, label, href, icon: Icon }) => (
              <Link key={key} href={href}>
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    active === key
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:block">{label}</span>
                </div>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
