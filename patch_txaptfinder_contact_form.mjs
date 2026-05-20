import fs from "node:fs";
import path from "node:path";

const endpoint = process.argv[2];

if (!endpoint || !endpoint.startsWith("https://script.google.com/macros/s/") || !endpoint.endsWith("/exec")) {
  console.error("Usage: node patch_txaptfinder_contact_form.mjs https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec");
  process.exit(1);
}

const projectRoot = process.cwd();
const contactFormPath = path.join(projectRoot, "client", "src", "components", "ContactForm.tsx");

if (!fs.existsSync(contactFormPath)) {
  console.error(`Could not find ${contactFormPath}`);
  process.exit(1);
}

let source = fs.readFileSync(contactFormPath, "utf8");
const original = source;

if (!source.includes("GOOGLE_SHEETS_ENDPOINT")) {
  source = source.replace(
    /(import[\s\S]*?;\n)(?!import)/,
    `$1\nconst GOOGLE_SHEETS_ENDPOINT = "${endpoint}";\n`
  );
}

source = source.replace(
  /(notes:\s*["']["'],\s*\n)(\s*}\);)/,
  `$1    smsConsent: false,\n$2`
);

source = source.replace(
  /const\s+handleSubmit\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s*\};/,
  `const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.firstName || !formData.email || !formData.phone) {
      toast.error("Please fill in your name, email, and phone number.");
      return;
    }

    if (!formData.smsConsent) {
      toast.error("Please agree to be contacted so I can follow up.");
      return;
    }

    setIsSubmitting(true);

    const payload = new URLSearchParams({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      budget: formData.budget,
      bedrooms: formData.bedrooms,
      moveIn: formData.moveIn,
      areas: formData.areas,
      pets: formData.pets,
      notes: formData.notes,
      smsConsent: String(formData.smsConsent),
      sms_consent: String(formData.smsConsent),
      contact_consent: String(formData.smsConsent),
      consent_source: "txaptfinder.com contact form",
      consent_timestamp: new Date().toISOString(),
      _source: "txaptfinder.com",
      page_url: window.location.href,
      user_agent: navigator.userAgent,
    });

    try {
      await fetch(GOOGLE_SHEETS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: payload,
      });

      toast.success("Thanks! Eric will be in touch soon.");
      setIsSubmitted(true);
    } catch (error) {
      toast.error("Could not save your information. Please call or text Eric.");
    } finally {
      setIsSubmitting(false);
    }
  };`
);

const checkbox = `        <label className="flex items-start gap-3 text-white/40 text-xs leading-relaxed">
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

`;

if (!source.includes("Reply STOP to opt out")) {
  source = source.replace(
    /(\s*<button[\s\S]*?type=["']submit["'][\s\S]*?>)/,
    `\n${checkbox}$1`
  );
}

if (source === original) {
  console.error("No changes made. The ContactForm.tsx structure did not match the expected Vite/React form.");
  process.exit(1);
}

fs.writeFileSync(contactFormPath, source);
console.log(`Patched ${contactFormPath}`);
