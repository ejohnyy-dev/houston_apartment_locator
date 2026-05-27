import { ChevronRight } from 'lucide-react';
import { Link } from 'wouter';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <div className="bg-slate-900/50 border-b border-white/5 py-3">
      <div className="container mx-auto px-4">
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/" className="text-gold hover:text-gold/80 transition-colors">
            Home
          </Link>
          {items.map((item, index) => (
            <div key={item.href} className="flex items-center gap-2">
              <ChevronRight size={16} className="text-white/30" />
              {index === items.length - 1 ? (
                <span className="text-white/70">{item.label}</span>
              ) : (
                <Link href={item.href} className="text-gold hover:text-gold/80 transition-colors">
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
