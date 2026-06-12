import { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronRight } from "lucide-react";
import BudgetRangeSelector from "./BudgetRangeSelector";

export interface QualificationData {
  preferredAreas: string[];
  moveInTimeline: string;
  bedrooms: string;
  bathrooms: string;
  budget: string | { min: number | null; max: number };
  pets: string[];
}

interface QualificationPromptProps {
  onComplete: (data: QualificationData) => void;
  onSkip?: () => void;
  isOpen: boolean;
  neighborhoods: string[];
  initialData?: QualificationData | null;
}

export const DEFAULT_NEIGHBORHOODS = [
  "Midtown", "Downtown", "Upper Kirby", "Montrose", "Galleria Area", "Heights",
  "Westchase", "Uptown", "Memorial", "Bellaire", "Sugar Land", "The Woodlands",
  "Katy", "Pearland",
];

const TIMELINE_OPTIONS = [
  { value: "immediate", label: "Immediate (within 2 weeks)" },
  { value: "1-3-months", label: "1–3 months" },
  { value: "3-6-months", label: "3–6 months" },
  { value: "6-plus-months", label: "6+ months" },
  { value: "flexible", label: "Flexible" },
];

const BEDROOM_OPTIONS = [
  { value: "studio", label: "Studio" },
  { value: "1bed", label: "1 Bedroom" },
  { value: "2bed", label: "2 Bedrooms" },
  { value: "3bed", label: "3 Bedrooms" },
  { value: "4plus", label: "4+ Bedrooms" },
];

const BATHROOM_OPTIONS = [
  { value: "1bath", label: "1 Bathroom" },
  { value: "1.5bath", label: "1.5 Bathrooms" },
  { value: "2bath", label: "2 Bathrooms" },
  { value: "2.5plus", label: "2.5+ Bathrooms" },
];

const PET_OPTIONS = [
  { value: "dogs", label: "Dogs" },
  { value: "cats", label: "Cats" },
  { value: "other", label: "Other Pets" },
];

const CONTACT_STEP = 6;
const TOTAL_STEPS = 7;

export function QualificationPrompt({
  onComplete,
  onSkip,
  isOpen,
  neighborhoods,
  initialData,
}: QualificationPromptProps) {
  const [step, setStep] = useState(() => (initialData ? CONTACT_STEP : 0));
  const [formData, setFormData] = useState<QualificationData>(() => initialData ?? {
    preferredAreas: [],
    moveInTimeline: "",
    bedrooms: "",
    bathrooms: "",
    budget: "",
    pets: [],
  });
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleBudgetChange = useCallback((range: { min: number | null; max: number }) => {
    setFormData((prev) => ({
      ...prev,
      budget: `$${range.min ?? 0}-${range.max}`,
    }));
  }, []);

  if (!isOpen) return null;

  const areaOptions = neighborhoods.length > 0 ? neighborhoods : DEFAULT_NEIGHBORHOODS;

  const handleAreaToggle = (area: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredAreas: prev.preferredAreas.includes(area)
        ? prev.preferredAreas.filter((a) => a !== area)
        : [...prev.preferredAreas, area],
    }));
  };

  const handlePetToggle = (pet: string) => {
    setFormData((prev) => ({
      ...prev,
      pets: prev.pets.includes(pet)
        ? prev.pets.filter((p) => p !== pet)
        : [...prev.pets, pet],
    }));
  };

  const handleContactChange = (field: "name" | "email" | "phone", value: string) => {
    let processed = value;
    if (field === "phone") {
      const digitsOnly = value.replace(/\D/g, "");
      if (digitsOnly.length > 10) return;
      processed = digitsOnly;
    }
    setContact((prev) => ({ ...prev, [field]: processed }));
  };

  const handleSubmit = async () => {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const budgetStr = typeof formData.budget === "string"
        ? formData.budget
        : `$${formData.budget.min ?? 0}-${formData.budget.max}`;

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: contact.name.trim().split(" ")[0] ?? contact.name.trim(),
          last_name: contact.name.trim().split(" ").slice(1).join(" "),
          email: contact.email.trim(),
          phone: contact.phone,
          budget: budgetStr,
          bedrooms: formData.bedrooms,
          move_in_timeline: formData.moveInTimeline,
          preferred_area: formData.preferredAreas.join(", "),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Submission failed");
      }

      onComplete(formData);
    } catch (error: any) {
      setSubmitError(error?.message || "We couldn't submit your info. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (step < CONTACT_STEP) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const isStepValid = () => {
    switch (step) {
      case 0: return formData.preferredAreas.length > 0;
      case 1: return formData.moveInTimeline !== "";
      case 2: return formData.bedrooms !== "";
      case 3: return formData.bathrooms !== "";
      case 4:
        return formData.budget !== "" && typeof formData.budget === "string" && formData.budget.includes("-");
      case 5: return true;
      case CONTACT_STEP:
        return (
          contact.name.trim().length > 0 &&
          contact.email.includes("@") &&
          contact.phone.replace(/\D/g, "").length >= 10
        );
      default: return true;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <Card className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Find Your Perfect Apartment
          </h2>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {TOTAL_STEPS} — Tell us what you're looking for
          </p>
          <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">
              Which neighborhoods interest you? (Select at least one)
            </Label>
            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
              {areaOptions.map((area) => (
                <button
                  key={area}
                  onClick={() => handleAreaToggle(area)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${
                    formData.preferredAreas.includes(area)
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">When do you want to move?</Label>
            <div className="space-y-2">
              {TIMELINE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormData((prev) => ({ ...prev, moveInTimeline: option.value }))}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${
                    formData.moveInTimeline === option.value
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">How many bedrooms?</Label>
            <div className="space-y-2">
              {BEDROOM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormData((prev) => ({ ...prev, bedrooms: option.value }))}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${
                    formData.bedrooms === option.value
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">How many bathrooms?</Label>
            <div className="space-y-2">
              {BATHROOM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFormData((prev) => ({ ...prev, bathrooms: option.value }))}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${
                    formData.bathrooms === option.value
                      ? "border-primary bg-primary/10"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">What's your monthly budget?</Label>
            <BudgetRangeSelector onChange={handleBudgetChange} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">Do you have any pets? (Optional)</Label>
            <div className="space-y-2">
              {PET_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 p-3 rounded-lg border-2 border-muted hover:border-primary/50 cursor-pointer"
                >
                  <Checkbox
                    id={option.value}
                    checked={formData.pets.includes(option.value)}
                    onCheckedChange={() => handlePetToggle(option.value)}
                  />
                  <label
                    htmlFor={option.value}
                    className="text-sm cursor-pointer font-medium leading-none"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === CONTACT_STEP && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">How can we reach you?</Label>
            <p className="text-xs text-muted-foreground">
              Your locator will personally share property details, exact locations, and
              current specials that match your preferences.
            </p>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Full name"
                value={contact.name}
                onChange={(e) => handleContactChange("name", e.target.value)}
                autoComplete="name"
              />
              <Input
                type="email"
                placeholder="Email"
                value={contact.email}
                onChange={(e) => handleContactChange("email", e.target.value)}
                autoComplete="email"
              />
              <Input
                type="tel"
                placeholder="Phone (10 digits)"
                value={contact.phone}
                onChange={(e) => handleContactChange("phone", e.target.value)}
                autoComplete="tel"
              />
            </div>
            {submitError && (
              <p className="text-xs text-red-600">{submitError}</p>
            )}
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0 || isSubmitting}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!isStepValid() || isSubmitting}
            className="flex-1"
          >
            {step === CONTACT_STEP ? (
              isSubmitting ? "Submitting..." : (
                <>Unlock the Map <ChevronRight className="w-4 h-4 ml-2" /></>
              )
            ) : (
              <>Next <ChevronRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </div>

        {onSkip && (
          <div className="mt-3 text-center">
            <button
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Browse listings first
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
