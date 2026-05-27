import { useState } from "react";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface InquiryFormProps {
  apartmentId: string;
  apartmentName: string;
  onClose: () => void;
}

export function InquiryForm({ apartmentId, apartmentName, onClose }: InquiryFormProps) {
  const [stage, setStage] = useState<"info" | "signup" | "success" | "error">("info");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createInquiry = trpc.inquiries.create.useMutation({
    onSuccess: () => {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createInquiry.mutateAsync({
        apartmentId,
        apartmentName,
        ...formData,
        moveInDate: "",
        message: "",
      });
    } catch (error) {
      console.error("Failed to submit inquiry:", error);
      setStage("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{apartmentName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {stage === "info" ? (
            <div className="space-y-4">
              {/* Address Info Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-amber-600 text-xl mt-1">🔒</div>
                  <div className="text-left">
                    <p className="font-semibold text-amber-900 text-sm">Exact address & landlord contact available upon request</p>
                    <p className="text-xs text-amber-800 mt-1">The full street address, landlord name, phone, and unit availability are provided directly by the owner after you make an inquiry.</p>
                  </div>
                </div>
              </div>

              {/* Button */}
              <button
                onClick={() => setStage("signup")}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span>👁️</span>
                See Full Property Info
              </button>

              {/* Footer Text */}
              <p className="text-center text-xs text-gray-600">
                The owner will reach out to you shortly!
              </p>
            </div>
          ) : stage === "signup" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStage("info")}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isSubmitting ? "Signing Up..." : "Sign Up"}
                </button>
              </div>
            </form>
          ) : stage === "success" ? (
            <div className="text-center py-8 space-y-4">
              <div className="text-green-600 text-4xl">✓</div>
              <div>
                <p className="text-gray-900 font-semibold text-sm mb-2">You're All Set!</p>
                <p className="text-xs text-gray-600">
                  I'll reach out with the full details shortly!
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-red-600 text-4xl mb-3">✕</div>
              <p className="text-gray-900 font-semibold mb-2">Something went wrong</p>
              <p className="text-sm text-gray-600 mb-4">
                Please try again or contact us directly.
              </p>
              <button
                onClick={() => setStage("signup")}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
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
