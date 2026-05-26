import { Phone, Search } from "lucide-react";
import { useEffect, useState } from "react";

export default function MobileStickyBottomCTA() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      // Hide CTA when near footer (last 200px of page)
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      const distanceFromBottom = docHeight - (scrollTop + windowHeight);

      setIsVisible(distanceFromBottom > 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-dark border-t border-white/10 p-3 z-40 safe-area-inset-bottom">
      <div className="flex gap-2 max-w-2xl mx-auto">
        <a
          href="tel:8326037278"
          className="flex-1 flex items-center justify-center gap-2 bg-gold text-dark px-4 py-2.5 rounded font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Phone size={16} />
          Call
        </a>
        <a
          href="/#contact"
          className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white px-4 py-2.5 rounded font-semibold text-sm hover:bg-white/15 transition-colors"
        >
          <Search size={16} />
          Search
        </a>
      </div>
    </div>
  );
}
