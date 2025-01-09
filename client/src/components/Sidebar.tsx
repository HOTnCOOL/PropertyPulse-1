import { Home, Users, Building2, DollarSign } from "lucide-react";
import { Link, useLocation } from "wouter";

const navItems = [
  { icon: Home, label: "Dashboard", href: "/" },
  { icon: Users, label: "Guests", href: "/guests" },
  { icon: Building2, label: "Properties", href: "/properties" },
  { icon: DollarSign, label: "Financials", href: "/financials" },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-sidebar border-r border-border">
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-sidebar-foreground">PropManager</h1>
      </div>
      <nav className="px-4">
        {navItems.map(({ icon: Icon, label, href }) => {
          const isActive = location === href;
          return (
            <Link key={href} href={href}>
              <a
                className={`flex items-center gap-3 px-4 py-3 rounded-md mb-1 transition-colors
                  ${isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </a>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
