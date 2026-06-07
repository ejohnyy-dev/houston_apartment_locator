import { useRoute, Link } from "wouter";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Home, DollarSign, BedDouble, Bath, Maximize2, Calendar,
  Phone, Mail, Globe, Heart, Share2, ChevronLeft, ChevronRight,
  Check, X, Zap
} from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useQualification } from "@/contexts/QualificationContext";
import { InquiryForm } from "@/components/InquiryForm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ApartmentDetail() {
  const [, params] = useRoute("/apartments/:slug");
  const slug = params?.slug;

  const { data: apartment, isLoading, error } = trpc.listings.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  const { isFavorited, toggleFavorite } = useFavorites();
  const { setShowQualificationPrompt, setQualificationData, qualificationData } = useQualification();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showInquiryForm, setShowInquiryForm] = useState(false);

  // Parse image URLs
  const images = useMemo(() => {
    if (!apartment?.imageUrls) return [];
    try {
      const parsed = JSON.parse(apartment.imageUrls);
      return Array.isArray(parsed) ? parsed : [apartment.primaryImageUrl || ""].filter(Boolean);
    } catch {
      return [apartment.primaryImageUrl || ""].filter(Boolean);
    }
  }, [apartment?.imageUrls, apartment?.primaryImageUrl]);

  // Parse amenities
  const interiorAmenities = useMemo(() => {
    if (!apartment?.interiorAmenities) return [];
    try {
      return JSON.parse(apartment.interiorAmenities);
    } catch {
      return [];
    }
  }, [apartment?.interiorAmenities]);

  const exteriorAmenities = useMemo(() => {
    if (!apartment?.exteriorAmenities) return [];
    try {
      return JSON.parse(apartment.exteriorAmenities);
    } catch {
      return [];
    }
  }, [apartment?.exteriorAmenities]);

  const featureHighlights = useMemo(() => {
    if (!apartment?.featureHighlights) return [];
    try {
      return JSON.parse(apartment.featureHighlights);
    } catch {
      return [];
    }
  }, [apartment?.featureHighlights]);

  const handleContactClick = () => {
    if (!qualificationData) {
      setShowQualificationPrompt(true);
    } else {
      setShowInquiryForm(true);
    }
  };

  const handleShare = async () => {
    if (!apartment) return;
    const url = `${window.location.origin}/apartments/${slug}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: apartment.name,
          text: `Check out ${apartment.name} in ${apartment.neighborhood}, Houston`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard!");
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Apartment Not Found</h1>
          <p className="text-slate-600 mb-6">We couldn't find this apartment listing.</p>
          <Link href="/search">
            <Button>Back to Search</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !apartment) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Skeleton className="h-96 w-full mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div>
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isFav = isFavorited(apartment.id.toString());
  const currentImage = images[currentImageIndex] || apartment.primaryImageUrl;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/search">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft size={18} />
              Back to Search
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="gap-2"
            >
              <Share2 size={18} />
              Share
            </Button>
            <Button
              variant={isFav ? "default" : "outline"}
              size="sm"
              onClick={() => toggleFavorite({ id: apartment.id.toString(), name: apartment.name, neighborhood: apartment.neighborhood || "", rentMin: apartment.minRent, bedrooms: apartment.bedrooms } as any)}
              className="gap-2"
            >
              <Heart size={18} fill={isFav ? "currentColor" : "none"} />
              {isFav ? "Saved" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="relative bg-slate-200 rounded-lg overflow-hidden aspect-video">
                {currentImage ? (
                  <img
                    src={currentImage}
                    alt={apartment.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-300">
                    <Home size={48} className="text-slate-400" />
                  </div>
                )}

                {/* Image Navigation */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setCurrentImageIndex((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      onClick={() => setCurrentImageIndex((i) => (i + 1) % images.length)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                      aria-label="Next image"
                    >
                      <ChevronRight size={24} />
                    </button>

                    {/* Image Counter */}
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>

              {/* Thumbnail Strip */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={cn(
                        "flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors",
                        idx === currentImageIndex ? "border-gold" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Property Info */}
            <div className="space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">{apartment.name}</h1>
                <div className="flex items-center gap-2 text-slate-600 mb-4">
                  <MapPin size={18} />
                  <span>{apartment.verifiedAddress || apartment.streetAddress || apartment.address}</span>
                </div>

                {apartment.special && (
                  <Badge className="bg-gold text-dark hover:bg-gold/90 mb-4">
                    <Zap size={14} className="mr-1" />
                    Special Offer
                  </Badge>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {apartment.bedrooms && (
                  <Card className="p-4 text-center">
                    <div className="flex justify-center mb-2">
                      <BedDouble size={24} className="text-gold" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{apartment.bedrooms}</div>
                    <div className="text-sm text-slate-600">Bedrooms</div>
                  </Card>
                )}
                {apartment.bathrooms && (
                  <Card className="p-4 text-center">
                    <div className="flex justify-center mb-2">
                      <Bath size={24} className="text-gold" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{apartment.bathrooms}</div>
                    <div className="text-sm text-slate-600">Bathrooms</div>
                  </Card>
                )}
                {apartment.minSqft && (
                  <Card className="p-4 text-center">
                    <div className="flex justify-center mb-2">
                      <Maximize2 size={24} className="text-gold" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{apartment.minSqft.toLocaleString()}</div>
                    <div className="text-sm text-slate-600">Sq Ft</div>
                  </Card>
                )}
                {apartment.builtYear && (
                  <Card className="p-4 text-center">
                    <div className="flex justify-center mb-2">
                      <Calendar size={24} className="text-gold" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{apartment.builtYear}</div>
                    <div className="text-sm text-slate-600">Built</div>
                  </Card>
                )}
              </div>

              {/* Rent Info */}
              <Card className="p-6 bg-gradient-to-r from-slate-50 to-slate-100">
                <div className="flex items-baseline gap-2 mb-4">
                  <DollarSign size={24} className="text-gold" />
                  <span className="text-4xl font-bold text-slate-900">{apartment.minRent.toLocaleString()}</span>
                  {apartment.maxRent && apartment.maxRent !== apartment.minRent && (
                    <>
                      <span className="text-slate-600">—</span>
                      <span className="text-4xl font-bold text-slate-900">${apartment.maxRent.toLocaleString()}</span>
                    </>
                  )}
                  <span className="text-slate-600">/month</span>
                </div>

                {/* Per-bedroom pricing */}
                {(apartment.price1brMin || apartment.price2brMin) && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                    {apartment.price1brMin && (
                      <div>
                        <div className="text-sm text-slate-600">1 Bedroom</div>
                        <div className="text-lg font-semibold text-slate-900">
                          ${apartment.price1brMin.toLocaleString()}
                          {apartment.price1brMax && apartment.price1brMax !== apartment.price1brMin && (
                            <> — ${apartment.price1brMax.toLocaleString()}</>
                          )}
                        </div>
                      </div>
                    )}
                    {apartment.price2brMin && (
                      <div>
                        <div className="text-sm text-slate-600">2 Bedroom</div>
                        <div className="text-lg font-semibold text-slate-900">
                          ${apartment.price2brMin.toLocaleString()}
                          {apartment.price2brMax && apartment.price2brMax !== apartment.price2brMin && (
                            <> — ${apartment.price2brMax.toLocaleString()}</>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Description & Special Offer */}
              {apartment.special && (
                <Card className="p-6 bg-gold/10 border-gold/20">
                  <h3 className="font-semibold text-slate-900 mb-2">Special Offer</h3>
                  <p className="text-slate-700">{apartment.special}</p>
                </Card>
              )}

              {/* Feature Highlights */}
              {featureHighlights.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-4">Highlights</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {featureHighlights.map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Check size={20} className="text-gold flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interior Amenities */}
              {interiorAmenities.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-4">Interior Amenities</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {interiorAmenities.map((amenity: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Check size={20} className="text-gold flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exterior Amenities */}
              {exteriorAmenities.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-4">Exterior Amenities</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {exteriorAmenities.map((amenity: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Check size={20} className="text-gold flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pet Policy */}
              {apartment.petPolicy && (
                <Card className="p-6">
                  <h3 className="font-semibold text-slate-900 mb-2">Pet Policy</h3>
                  <p className="text-slate-700">{apartment.petPolicy}</p>
                </Card>
              )}

              {/* Availability */}
              {apartment.availability && (
                <Card className="p-6 border-gold/20 bg-gold/5">
                  <h3 className="font-semibold text-slate-900 mb-2">Availability</h3>
                  <p className="text-slate-700">{apartment.availability}</p>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Card */}
            <Card className="p-6 sticky top-24">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Contact Property</h3>

              <Button
                onClick={handleContactClick}
                className="w-full bg-gold text-dark hover:bg-gold/90 mb-4"
                size="lg"
              >
                Schedule Tour
              </Button>

              {apartment.phone && (
                <a href={`tel:${apartment.phone}`}>
                  <Button variant="outline" className="w-full gap-2 mb-2">
                    <Phone size={18} />
                    {apartment.phone}
                  </Button>
                </a>
              )}

              {apartment.email && (
                <a href={`mailto:${apartment.email}`}>
                  <Button variant="outline" className="w-full gap-2 mb-2">
                    <Mail size={18} />
                    Email
                  </Button>
                </a>
              )}

              {apartment.website && (
                <a href={apartment.website} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full gap-2">
                    <Globe size={18} />
                    Visit Website
                  </Button>
                </a>
              )}

              {apartment.managedBy && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-600 mb-1">Managed by</p>
                  <p className="font-medium text-slate-900">{apartment.managedBy}</p>
                </div>
              )}
            </Card>

            {/* Property Details Card */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Property Details</h3>
              <div className="space-y-3">
                {apartment.neighborhood && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-wide">Neighborhood</p>
                    <p className="font-medium text-slate-900">{apartment.neighborhood}</p>
                  </div>
                )}
                {apartment.maxSqft && (
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-wide">Square Footage</p>
                    <p className="font-medium text-slate-900">
                      {apartment.minSqft?.toLocaleString()} — {apartment.maxSqft.toLocaleString()} sq ft
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Inquiry Form Modal */}
      {showInquiryForm && (
        <InquiryForm
          apartmentId={apartment.id.toString()}
          apartmentName={apartment.name}
          onClose={() => setShowInquiryForm(false)}
        />
      )}
    </div>
  );
}
