export default function Footer() {
  return (
    <footer className="py-10 bg-dark border-t border-white/5">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="#" className="font-display text-lg text-white">
            Houston <span className="text-gold">Locator</span>
          </a>
          <div className="flex gap-6">
            <a href="#services" className="text-white/40 hover:text-white/70 text-sm transition-colors">Services</a>
            <a href="#houston" className="text-white/40 hover:text-white/70 text-sm transition-colors">Houston</a>
            <a href="#how-it-works" className="text-white/40 hover:text-white/70 text-sm transition-colors">How It Works</a>
            <a href="#contact" className="text-white/40 hover:text-white/70 text-sm transition-colors">Contact</a>
          </div>
          <p className="text-white/25 text-xs">
            &copy; {new Date().getFullYear()} Houston Locator. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
