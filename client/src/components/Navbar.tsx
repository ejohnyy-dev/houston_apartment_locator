import { useState, useEffect } from "react";
import { Menu, X, Phone, Mail } from "lucide-react";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/habitat-logo_3360fdb4.png";

const links = [
  { label: "Services", href: "#services" },
  { label: "Houston", href: "#houston" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${scrolled ? "bg-dark/95 border-b border-white/5" : "bg-transparent"}`}>
      <div className="container flex items-center justify-between h-16 md:h-18">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 shrink-0">
          <img src={LOGO} alt="Habitat Apartment Locators" className="h-10 md:h-12 w-auto" />
        </a>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-7">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-white/60 hover:text-white text-sm font-medium transition-colors">
              {l.label}
            </a>
          ))}
          <a href="mailto:ericjohnson@txaptfinder.com" className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors">
            <Mail size={14} />
            ericjohnson@txaptfinder.com
          </a>
          <a href="tel:8326037278" className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors">
            <Phone size={14} />
            (832) 603-7278
          </a>
          <a href="#contact" className="px-5 py-2 bg-gold text-dark text-sm font-semibold rounded hover:opacity-90 transition-opacity">
            Get Started
          </a>
        </div>

        {/* Mobile Toggle */}
        <button onClick={() => setOpen(!open)} className="lg:hidden text-white/70" aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-dark border-t border-white/5 px-4 py-4 space-y-3">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-white/60 hover:text-white text-sm font-medium">
              {l.label}
            </a>
          ))}
          <a href="mailto:ericjohnson@txaptfinder.com" onClick={() => setOpen(false)} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium">
            <Mail size={14} />
            ericjohnson@txaptfinder.com
          </a>
          <a href="tel:8326037278" onClick={() => setOpen(false)} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium">
            <Phone size={14} />
            (832) 603-7278
          </a>
          <a href="#contact" onClick={() => setOpen(false)} className="block text-center py-2.5 bg-gold text-dark text-sm font-semibold rounded">
            Get Started
          </a>
        </div>
      )}
    </nav>
  );
}
