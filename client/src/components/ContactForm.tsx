import { useState } from "react";
import { toast } from "sonner";

const budgetOptions = [
  "Under $1,000",
  "$1,000 – $1,500",
  "$1,500 – $2,000",
  "$2,000 – $2,500",
  "$2,500 – $3,000",
  "$3,000+",
];

const bedroomOptions = ["Studio", "1 Bedroom", "2 Bedrooms", "3+ Bedrooms"];

const moveInOptions = [
  "ASAP",
  "Within 30 days",
  "1–2 months",
  "3+ months",
  "Just browsing",
];

const areaOptions = [
  "Downtown / Midtown",
  "Montrose / Museum District",
  "The Heights",
  "Galleria / Uptown",
  "Medical Center / NRG",
  "Katy / West Houston",
  "Sugar Land / Fort Bend",
  "The Woodlands / Spring",
  "Clear Lake / Pearland",
  "Other / Not Sure",
];

export default function ContactForm() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    budget: "",
    bedrooms: "",
    moveIn: "",
    areas: "",
    pets: "",
    notes: "",
  });
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.email || !form.phone) {
      toast.error("Please fill in your name, email, and phone number.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submitted_at: new Date().toISOString(),
          source: "txaptfinder.com",
          first_name: form.firstName,
          last_name: form.lastName,
          name: `${form.firstName} ${form.lastName}`.trim(),
          email: form.email,
          phone: form.phone,
          budget: form.budget,
          bedrooms: form.bedrooms,
          move_in_timeline: form.moveIn,
          preferred_area: form.areas,
          pets: form.pets,
          notes: form.notes,
          sms_consent: smsConsent,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Unable to send your information.");
      }

      setSubmitted(true);
      toast.success("Thanks! Eric will be in touch soon.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send your information. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section id="contact" className="py-20 md:py-28 bg-dark-card">
        <div className="container">
          <div className="max-w-lg mx-auto text-center py-16">
            <h2 className="font-display text-3xl text-white mb-4">
              Thank You!
            </h2>
            <p className="text-white/50 text-base leading-relaxed mb-6">
              Eric Johnson has received your information and will reach out
              within 24 hours to start your apartment search.
            </p>
            <p className="text-white/40 text-sm">
              Need something sooner? Call directly at{" "}
              <a href="tel:8326037278" className="text-gold hover:underline">
                (832) 603-7278
              </a>
            </p>
          </div>
        </div>
      </section>
    );
  }

  const inputClass =
    "w-full bg-dark border border-white/10 rounded px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-gold/50 transition-colors";
  const selectClass =
    "w-full bg-dark border border-white/10 rounded px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/50 transition-colors appearance-none";
  const labelClass =
    "block text-white/60 text-xs font-medium tracking-wide uppercase mb-1.5";

  return (
    <section id="contact" className="py-20 md:py-28 bg-dark-card">
      <div className="container">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs font-medium tracking-widest uppercase mb-3">
              Get Started
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-white mb-4">
              Start Your Houston Apartment Search Today
            </h2>
            <p className="text-white/50 text-base leading-relaxed">
              Tell me a bit about yourself and what you're looking for. I'll
              take it from there.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name *</label>
                <input
                  type="text"
                  placeholder="John"
                  value={form.firstName}
                  onChange={e => update("firstName", e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input
                  type="text"
                  placeholder="Doe"
                  value={form.lastName}
                  onChange={e => update("lastName", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Contact Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Email *</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={e => update("email", e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Phone *</label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={form.phone}
                  onChange={e => update("phone", e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/5 pt-6">
              <p className="text-white/40 text-xs font-medium tracking-wide uppercase mb-5">
                Apartment Preferences
              </p>
            </div>

            {/* Budget & Bedrooms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Monthly Budget</label>
                <select
                  value={form.budget}
                  onChange={e => update("budget", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select budget</option>
                  {budgetOptions.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Bedrooms</label>
                <select
                  value={form.bedrooms}
                  onChange={e => update("bedrooms", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select bedrooms</option>
                  {bedroomOptions.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Move-in & Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Move-In Timeline</label>
                <select
                  value={form.moveIn}
                  onChange={e => update("moveIn", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select timeline</option>
                  {moveInOptions.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Preferred Area</label>
                <select
                  value={form.areas}
                  onChange={e => update("areas", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select area</option>
                  {areaOptions.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pets */}
            <div>
              <label className={labelClass}>Do you have pets?</label>
              <select
                value={form.pets}
                onChange={e => update("pets", e.target.value)}
                className={selectClass}
              >
                <option value="">Select</option>
                <option value="No pets">No pets</option>
                <option value="Dog(s)">Dog(s)</option>
                <option value="Cat(s)">Cat(s)</option>
                <option value="Dog(s) and Cat(s)">Dog(s) and Cat(s)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>Anything else I should know?</label>
              <textarea
                rows={3}
                placeholder="Amenities you need, specific complexes you're interested in, etc."
                value={form.notes}
                onChange={e => update("notes", e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* SMS consent */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={smsConsent}
                onChange={e => setSmsConsent(e.target.checked)}
                className="mt-0.5 accent-[#c9a55c]"
              />
              <span className="text-white/40 text-xs leading-relaxed">
                Yes, you can text me about apartment options. Message and data
                rates may apply. Reply STOP to opt out anytime.
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gold text-dark font-semibold text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Submit"}
            </button>

            <p className="text-white/25 text-xs text-center">
              By submitting, you agree to be contacted about apartment options.
              We'll never spam you.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
