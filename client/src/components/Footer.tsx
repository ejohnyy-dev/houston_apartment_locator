import { Phone, Mail } from "lucide-react";

const LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663501304397/4gMGD9qetV63jA9Ts6DXxD/habitat-logo_3360fdb4.png";

export default function Footer() {
  return (
    <footer className="py-12 bg-dark border-t border-white/5">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {/* Brand */}
          <div>
            <img src={LOGO} alt="Habitat Apartment Locators" className="h-12 w-auto mb-3" />
            <p className="text-white/40 text-sm leading-relaxed">
              Your free Houston apartment locator service.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-2">
            <p className="text-white/60 text-xs font-medium tracking-wide uppercase mb-1">Quick Links</p>
            <a href="/#services" className="text-white/40 hover:text-white/70 text-sm transition-colors">Services</a>
            <a href="/#houston" className="text-white/40 hover:text-white/70 text-sm transition-colors">Houston</a>
            <a href="/#how-it-works" className="text-white/40 hover:text-white/70 text-sm transition-colors">How It Works</a>
            <a href="/houston-apartment-move-in-specials" className="text-white/40 hover:text-white/70 text-sm transition-colors">Move-In Specials</a>
            <a href="/faq" className="text-white/40 hover:text-white/70 text-sm transition-colors">FAQ</a>
            <a href="/#contact" className="text-white/40 hover:text-white/70 text-sm transition-colors">Contact</a>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-2">
            <p className="text-white/60 text-xs font-medium tracking-wide uppercase mb-1">Contact</p>
            <p className="text-white/50 text-sm">Eric Johnson</p>
            <a href="tel:8326037278" className="flex items-center gap-1.5 text-gold hover:text-gold/80 text-sm transition-colors">
              <Phone size={14} />
              (832) 603-7278
            </a>
            <a href="mailto:ericjohnson@txaptfinder.com" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
              <Mail size={14} />
              ericjohnson@txaptfinder.com
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/5 text-center">
          <p className="text-white/20 text-xs">
            &copy; {new Date().getFullYear()} Habitat Apartment Locators. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
