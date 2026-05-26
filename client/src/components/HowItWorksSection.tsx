const steps = [
  {
    num: "01",
    title: "Tell Us What You Need",
    desc: "Fill out our quick form with your budget, preferred neighborhoods, move-in date, and must-haves.",
  },
  {
    num: "02",
    title: "We Curate Your Options",
    desc: "Our team researches the best apartments that fit your criteria, including exclusive deals not listed online.",
  },
  {
    num: "03",
    title: "Tour & Compare",
    desc: "We schedule tours at your convenience and help you compare your top picks side by side.",
  },
  {
    num: "04",
    title: "Move In",
    desc: "Once you've chosen your new home, we help with the application and make sure move-in is seamless.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-dark">
      <div className="container">
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="text-gold text-xs font-medium tracking-widest uppercase mb-3">The Process</p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">How It Works</h2>
          <p className="text-white/50 text-base leading-relaxed">
            Four simple steps from search to move-in.
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-8">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-5 items-start">
              <span className="text-gold font-display text-2xl shrink-0 w-10">{s.num}</span>
              <div>
                <h3 className="font-display text-lg text-white mb-1">{s.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
