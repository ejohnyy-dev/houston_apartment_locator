import { useState } from "react";
import { X, Heart } from "lucide-react";
import { cn, getDisplayName } from "@/lib/utils";
import { FavoriteApartment } from "@/hooks/useFavorites";
import { trpc } from "@/lib/trpc";
import { QualificationData } from "./QualificationPrompt";
import { useQualification } from "@/contexts/QualificationContext";

interface InquiryFormProps {
  apartmentId: string;
  apartmentName: string;
  favorites?: FavoriteApartment[];
  qualificationData?: QualificationData;
  onClose: () => void;
}



export function InquiryForm({ apartmentId, apartmentName, favorites, qualificationData, onClose }: InquiryFormProps) {
  const [stage, setStage] = useState<"info" | "signup" | "success" | "error">("info");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { setQualificationData, markQualified } = useQualification();

  const createInquiry = trpc.inquiries.create.useMutation({
    onSuccess: (data) => {
      // Persist qualification state so this visitor stays qualified across sessions.
      // The server sets a qual_session cookie; we also store the token in localStorage
      // as a fallback identifier for new-device re-qualification.
      if (data?.sessionToken) {
        try {
          localStorage.setItem("qual_session_token", data.sessionToken);
        } catch { /* ignore */ }
      }
      // Mark as qualified in the context so the lead gate lifts immediately
      markQualified();
      if (qualificationData) {
        setQualificationData(qualificationData);
      }
      setStage("success");
      setFormData({
        name: "",
        email: "",
        phone: "",
      });
      setTimeout(() => {
        onClose();
      }, 3000);
    },
    onError: () => {
      setStage("error");
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "");
      if (digitsOnly.length <= 10) {
        processedValue = digitsOnly;
      } else {
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setErrorMessage("Please enter your name");
      setStage("error");
      return;
    }

    if (!formData.email.includes("@")) {
      setErrorMessage("Please enter a valid email address");
      setStage("error");
      return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setErrorMessage("Please enter a valid 10-digit phone number");
      setStage("error");
      return;
    }

    setIsSubmitting(true);

    try {
      const favoriteIds = favorites?.map(fav => fav.apartmentId) || [];
      await createInquiry.mutateAsync({
        apartmentId,
        apartmentName,
        ...formData,
        moveInDate: qualificationData?.moveInTimeline || "",
        message: "",
        favoriteIds: JSON.stringify(favoriteIds),
        qualificationData: qualificationData ? JSON.stringify(qualificationData) : undefined,
      });
    } catch (error) {
      console.error("Failed to submit inquiry:", error);
      setErrorMessage("We had trouble submitting your request. Please try again.");
      setStage("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b sticky top-0 bg-white">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate pr-2">{getDisplayName(apartmentName)}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0 p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {stage === "info" ? (
            <div className="space-y-4">
              {/* Favorites List */}
              {favorites && favorites.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="w-4 h-4 text-blue-600 fill-blue-600" />
                    <p className="font-semibold text-blue-900 text-sm">Your Saved Apartments ({favorites.length})</p>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {favorites.map((fav) => (
                      <div key={fav.apartmentId} className="text-xs text-blue-800 bg-white rounded px-2 py-1.5">
                        <p className="font-medium">{getDisplayName(fav.apartmentName)}</p>
                        {fav.neighborhood && <p className="text-blue-700">{fav.neighborhood}</p>}
                        {fav.rentMin && <p className="text-blue-700">${fav.rentMin.toLocaleString()} - ${fav.rentMax?.toLocaleString() || "N/A"}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Address Info Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-amber-600 text-xl mt-1 flex-shrink-0">🔒</div>
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-amber-900 text-sm">Property name & exact location shared personally</p>
                    <p className="text-xs text-amber-800 mt-1">Your locator will personally share the property name, full street address, and unit availability with you after you make an inquiry.</p>
                  </div>
                </div>
              </div>

              {/* Button */}
              <button
                onClick={() => setStage("signup")}
                className="w-full px-4 py-4 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium flex items-center justify-center gap-2 min-h-[48px] sm:min-h-auto text-base sm:text-sm"
              >
                <span>👁️</span>
                See Full Property Details
              </button>

              {/* Footer Text */}
              <p className="text-center text-xs text-gray-600">
                Your locator will reach out to you shortly!
              </p>
            </div>
          ) : stage === "signup" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-base min-h-[44px] text-gray-900"
                  placeholder="John Doe"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-base min-h-[44px] text-gray-900"
                  placeholder="john@example.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-base min-h-[44px] text-gray-900"
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStage("info")}
                  className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium min-h-[44px] text-base"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium min-h-[44px] text-base"
                >
                  {isSubmitting ? "Signing Up..." : "Sign Up"}
                </button>
              </div>
            </form>
          ) : stage === "success" ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-green-600 text-5xl">✓</div>
              <div>
                <p className="text-gray-900 font-semibold text-base mb-2">You're All Set!</p>
                <p className="text-sm text-gray-600">
                  I'll reach out with the full details shortly!
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="text-red-600 text-5xl">✕</div>
              <div>
                <p className="text-gray-900 font-semibold text-base mb-2">Something went wrong</p>
                <p className="text-sm text-gray-600 mb-4">
                  {errorMessage || "Please try again or contact us directly."}
                </p>
              </div>
              <button
                onClick={() => setStage("signup")}
                className="w-full px-4 py-3 bg-blue-600 text-white text-base rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium min-h-[44px]"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
