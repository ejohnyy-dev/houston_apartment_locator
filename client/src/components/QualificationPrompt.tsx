import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight } from "lucide-react";
import { BottomSheet } from "./BottomSheet";

export interface QualificationData {
  preferredAreas: string[];
  moveInTimeline: string;
  minBedrooms: number;
  maxBedrooms: number;
  minBathrooms: number;
  maxBathrooms: number;
  minBudget: number;
  maxBudget: number;
  pets: {
    dogs: boolean;
    cats: boolean;
    other: string;
  };
}

interface QualificationPromptProps {
  onComplete: (data: QualificationData) => void;
  isOpen: boolean;
  neighborhoods: string[];
}

const TIMELINE_OPTIONS = [
  { value: "immediate", label: "Immediate (within 2 weeks)" },
  { value: "1-3-months", label: "1-3 months" },
  { value: "3-6-months", label: "3-6 months" },
  { value: "6-plus-months", label: "6+ months" },
  { value: "flexible", label: "Flexible" },
];

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];
const BATHROOM_OPTIONS = [1, 1.5, 2, 2.5, 3];

export function QualificationPrompt({
  onComplete,
  isOpen,
  neighborhoods,
}: QualificationPromptProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<QualificationData>({
    preferredAreas: [],
    moveInTimeline: "flexible",
    minBedrooms: 1,
    maxBedrooms: 3,
    minBathrooms: 1,
    maxBathrooms: 2,
    minBudget: 1000,
    maxBudget: 3000,
    pets: {
      dogs: false,
      cats: false,
      other: "",
    },
  });

  if (!isOpen) return null;

  const handleAreaToggle = (area: string) => {
    setFormData((prev) => ({
      ...prev,
      preferredAreas: prev.preferredAreas.includes(area)
        ? prev.preferredAreas.filter((a) => a !== area)
        : [...prev.preferredAreas, area],
    }));
  };

  const handleNext = () => {
    if (step < 4) {
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
        return formData.minBedrooms <= formData.maxBedrooms;
      case 3:
        return formData.minBathrooms <= formData.maxBathrooms;
      case 4:
        return formData.minBudget <= formData.maxBudget;
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
            Step {step + 1} of 5 - Tell us what you're looking for
          </p>
          <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((step + 1) / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 0: Preferred Areas */}
        {step === 0 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">
              Which neighborhoods interest you?
            </Label>
            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
              {neighborhoods.map((area) => (
                <div key={area} className="flex items-center space-x-2">
                  <Checkbox
                    id={area}
                    checked={formData.preferredAreas.includes(area)}
                    onCheckedChange={() => handleAreaToggle(area)}
                  />
                  <label
                    htmlFor={area}
                    className="text-sm cursor-pointer font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {area}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Move-in Timeline */}
        {step === 1 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">When do you want to move?</Label>
            <Select value={formData.moveInTimeline} onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, moveInTimeline: value }))
            }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMELINE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 2: Bedrooms */}
        {step === 2 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">How many bedrooms?</Label>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Minimum: {formData.minBedrooms}
                </label>
                <Input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.minBedrooms}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      minBedrooms: Math.min(parseInt(e.target.value), prev.maxBedrooms),
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Maximum: {formData.maxBedrooms}
                </label>
                <Input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.maxBedrooms}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxBedrooms: Math.max(parseInt(e.target.value), prev.minBedrooms),
                    }))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Bathrooms */}
        {step === 3 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">How many bathrooms?</Label>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Minimum: {formData.minBathrooms}
                </label>
                <Input
                  type="range"
                  min="1"
                  max="3"
                  step="0.5"
                  value={formData.minBathrooms}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      minBathrooms: Math.min(parseFloat(e.target.value), prev.maxBathrooms),
                    }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Maximum: {formData.maxBathrooms}
                </label>
                <Input
                  type="range"
                  min="1"
                  max="3"
                  step="0.5"
                  value={formData.maxBathrooms}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxBathrooms: Math.max(parseFloat(e.target.value), prev.minBathrooms),
                    }))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Budget & Pets */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">What's your budget?</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min</label>
                  <Input
                    type="number"
                    value={formData.minBudget}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        minBudget: parseInt(e.target.value) || 0,
                      }))
                    }
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max</label>
                  <Input
                    type="number"
                    value={formData.maxBudget}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        maxBudget: parseInt(e.target.value) || 0,
                      }))
                    }
                    placeholder="3000"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Do you have pets?</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dogs"
                    checked={formData.pets.dogs}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        pets: { ...prev.pets, dogs: checked as boolean },
                      }))
                    }
                  />
                  <label htmlFor="dogs" className="text-sm cursor-pointer font-medium">
                    Dogs
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cats"
                    checked={formData.pets.cats}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        pets: { ...prev.pets, cats: checked as boolean },
                      }))
                    }
                  />
                  <label htmlFor="cats" className="text-sm cursor-pointer font-medium">
                    Cats
                  </label>
                </div>
                <Input
                  type="text"
                  placeholder="Other pets (e.g., birds, reptiles)"
                  value={formData.pets.other}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      pets: { ...prev.pets, other: e.target.value },
                    }))
                  }
                  className="mt-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 mt-8">
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
            {step === 4 ? (
              <>
                Find Matches <ChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
