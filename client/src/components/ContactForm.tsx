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
  const [formData, setFormData] = useState({
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
    smsConsent: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: string, value: string | boolean) => {
    let processedValue: string | boolean = value;

    if (field === "phone" && typeof value === "string") {
      const digitsOnly = value.replace(/\D/g, "");
      processedValue = digitsOnly.slice(0, 10);
    }

    setFormData((prev) => ({ ...prev, [field]: processedValue }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.firstName.trim()) {
      toast.error("Please enter your first name.");
      return;
    }

    if (!formData.email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }

    if (!formData.smsConsent) {
      toast.error("Please agree to be contacted so I can follow up.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      budget: formData.budget,
      bedrooms: formData.bedrooms,
      move_in_timeline: formData.moveIn,
      preferred_area: formData.areas,
      pets: formData.pets,
      notes: formData.notes,
      smsConsent: formData.smsConsent,
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to submit form");
      }

      toast.success("Thanks! Eric will be in touch soon.");
      setIsSubmitted(true);
    } catch (error) {
      toast.error("Could not save your information. Please call or text Eric.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <section id="contact" className="py-20 md:py-28 bg-dark-card">
        <div className="container">
          <div className="max-w-lg mx-auto text-center py-16">
            <h2 className="font-display text-3xl text-white mb-4">Thank You!</h2>
            <p className="text-white/50 text-base leading-relaxed mb-6">
              Eric Johnson has received your information and will reach out within 24 hours to start your apartment search.
            </p>
            <p className="text-white/40 text-sm">
              Need something sooner? Call directly at{" "}
              <a href="tel:8326037278" className="text-gold hover:underline">(832) 603-7278</a>
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
  const labelClass = "block text-white/60 text-xs font-medium tracking-wide uppercase mb-1.5";

  return (
    <section id="contact" className="py-20 md:py-28 bg-dark-card">
      <div className="container">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs font-medium tracking-widest uppercase mb-3">Get Started</p>
            <h2 className="font-display text-3xl md:text-4xl text-white mb-4">
              Start Your Houston Apartment Search Today
            </h2>
            <p className="text-white/50 text-base leading-relaxed">
              Tell me a bit about yourself and what you're looking for. I'll take it from there.
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
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
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
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Phone *</label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/5 pt-6">
              <p className="text-white/40 text-xs font-medium tracking-wide uppercase mb-5">Apartment Preferences</p>
            </div>

            {/* Budget & Bedrooms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Monthly Budget</label>
                <select
                  value={formData.budget}
                  onChange={(e) => handleInputChange("budget", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select budget</option>
                  {budgetOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Bedrooms</label>
                <select
                  value={formData.bedrooms}
                  onChange={(e) => handleInputChange("bedrooms", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select bedrooms</option>
                  {bedroomOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Move-in & Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Move-In Timeline</label>
                <select
                  value={formData.moveIn}
                  onChange={(e) => handleInputChange("moveIn", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select timeline</option>
                  {moveInOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Preferred Area</label>
                <select
                  value={formData.areas}
                  onChange={(e) => handleInputChange("areas", e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select area</option>
                  {areaOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pets */}
            <div>
              <label className={labelClass}>Do you have pets?</label>
              <select
                value={formData.pets}
                onChange={(e) => handleInputChange("pets", e.target.value)}
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
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* SMS Consent Checkbox */}
            <label className="flex items-start gap-3 text-white/40 text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={formData.smsConsent}
                onChange={(event) => handleInputChange("smsConsent", event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-dark text-gold focus:ring-gold/40"
                required
              />
              <span>
                I agree to be contacted by call, text, or email about apartment options.
                Message/data rates may apply. Reply STOP to opt out.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gold text-dark font-semibold text-sm rounded hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? "Sending..." : "Submit"}
            </button>

            <p className="text-white/25 text-xs text-center">
              By submitting, you agree to be contacted about apartment options. We'll never spam you.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
