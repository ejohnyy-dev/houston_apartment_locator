import { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
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
}

// Fallback shown while listings (and their neighborhoods) are still loading,
// since the questionnaire opens immediately on page load.
export const DEFAULT_NEIGHBORHOODS = [
  "Midtown", "Downtown", "Upper Kirby", "Montrose", "Galleria Area", "Heights",
  "Westchase", "Uptown", "Memorial", "Bellaire", "Sugar Land", "The Woodlands",
  "Katy", "Pearland",
];

const TIMELINE_OPTIONS = [
  { value: "immediate", label: "Immediate (within 2 weeks)" },
  { value: "1-3-months", label: "1-3 months" },
  { value: "3-6-months", label: "3-6 months" },
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

// BUDGET_OPTIONS removed - now using BudgetRangeSelector component

const PET_OPTIONS = [
  { value: "dogs", label: "Dogs" },
  { value: "cats", label: "Cats" },
  { value: "other", label: "Other Pets" },
];

export function QualificationPrompt({
  onComplete,
  onSkip,
  isOpen,
  neighborhoods,
}: QualificationPromptProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<QualificationData>({
    preferredAreas: [],
    moveInTimeline: "",
    bedrooms: "",
    bathrooms: "",
    budget: "",
    pets: [],
  });

  // Memoize the budget onChange callback to prevent infinite loop
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

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 0:
        return formData.preferredAreas.length > 0;
      case 1:
        return formData.moveInTimeline !== "";
      case 2:
        return formData.bedrooms !== "";
      case 3:
        return formData.bathrooms !== "";
      case 4:
        return formData.budget !== "" && typeof formData.budget === "string" && formData.budget.includes("-");
      case 5:
        return true; // Pets are optional
      default:
        return true;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <Card className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6 md:p-8 shadow-xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Find Your Perfect Apartment
          </h2>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of 6 - Tell us what you're looking for
          </p>
          <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 0: Preferred Areas */}
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
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
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

        {/* Step 1: Move-in Timeline */}
        {step === 1 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">When do you want to move?</Label>
            <div className="space-y-2">
              {TIMELINE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, moveInTimeline: option.value }))
                  }
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
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

        {/* Step 2: Bedrooms */}
        {step === 2 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">How many bedrooms?</Label>
            <div className="space-y-2">
              {BEDROOM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, bedrooms: option.value }))
                  }
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
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

        {/* Step 3: Bathrooms */}
        {step === 3 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">How many bathrooms?</Label>
            <div className="space-y-2">
              {BATHROOM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, bathrooms: option.value }))
                  }
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
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

        {/* Step 4: Budget */}
        {step === 4 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">What's your monthly budget?</Label>
            <BudgetRangeSelector
              onChange={handleBudgetChange}
            />
          </div>
        )}

        {/* Step 5: Pets */}
        {step === 5 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">Do you have any pets? (Optional)</Label>
            <div className="space-y-2">
              {PET_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2 p-3 rounded-lg border-2 border-muted hover:border-primary/50 cursor-pointer">
                  <Checkbox
                    id={option.value}
                    checked={formData.pets.includes(option.value)}
                    onCheckedChange={() => handlePetToggle(option.value)}
                  />
                  <label
                    htmlFor={option.value}
                    className="text-sm cursor-pointer font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex gap-3">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="flex-1"
          >
            {step === 5 ? (
              <>
                Complete <ChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </>
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
