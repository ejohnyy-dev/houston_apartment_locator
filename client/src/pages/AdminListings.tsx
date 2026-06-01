import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Edit,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

type Listing = {
  id: number;
  propertyId?: string | null;
  name: string;
  address?: string | null;
  city: string;
  state: string;
  neighborhood?: string | null;
  minRent: number;
  maxRent?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  minSqft?: number | null;
  maxSqft?: number | null;
  builtYear?: number | null;
  availability?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string | null;
  special?: string | null;
  featureHighlights?: string | null;
  exteriorAmenities?: string | null;
  interiorAmenities?: string | null;
  petPolicy?: string | null;
  managedBy?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  isActive: number;
  sortOrder?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type FormData = {
  propertyId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  neighborhood: string;
  minRent: string;
  maxRent: string;
  bedrooms: string;
  bathrooms: string;
  minSqft: string;
  maxSqft: string;
  builtYear: string;
  availability: string;
  primaryImageUrl: string;
  imageUrls: string;
  special: string;
  featureHighlights: string;
  exteriorAmenities: string;
  interiorAmenities: string;
  petPolicy: string;
  managedBy: string;
  latitude: string;
  longitude: string;
  sortOrder: string;
};

const emptyForm: FormData = {
  propertyId: "",
  name: "",
  address: "",
  city: "Houston",
  state: "TX",
  neighborhood: "",
  minRent: "",
  maxRent: "",
  bedrooms: "",
  bathrooms: "",
  minSqft: "",
  maxSqft: "",
  builtYear: "",
  availability: "",
  primaryImageUrl: "",
  imageUrls: "",
  special: "",
  featureHighlights: "",
  exteriorAmenities: "",
  interiorAmenities: "",
  petPolicy: "",
  managedBy: "Habitat Locators",
  latitude: "",
  longitude: "",
  sortOrder: "0",
};

function listingToForm(l: Listing): FormData {
  return {
    propertyId: l.propertyId ?? "",
    name: l.name,
    address: l.address ?? "",
    city: l.city,
    state: l.state,
    neighborhood: l.neighborhood ?? "",
    minRent: l.minRent.toString(),
    maxRent: l.maxRent?.toString() ?? "",
    bedrooms: l.bedrooms?.toString() ?? "",
    bathrooms: l.bathrooms?.toString() ?? "",
    minSqft: l.minSqft?.toString() ?? "",
    maxSqft: l.maxSqft?.toString() ?? "",
    builtYear: l.builtYear?.toString() ?? "",
    availability: l.availability ?? "",
    primaryImageUrl: l.primaryImageUrl ?? "",
    imageUrls: l.imageUrls ?? "",
    special: l.special ?? "",
    featureHighlights: l.featureHighlights ?? "",
    exteriorAmenities: l.exteriorAmenities ?? "",
    interiorAmenities: l.interiorAmenities ?? "",
    petPolicy: l.petPolicy ?? "",
    managedBy: l.managedBy ?? "Habitat Locators",
    latitude: l.latitude ?? "",
    longitude: l.longitude ?? "",
    sortOrder: l.sortOrder?.toString() ?? "0",
  };
}

function formToInput(f: FormData) {
  return {
    propertyId: f.propertyId || null,
    name: f.name,
    address: f.address || null,
    city: f.city || "Houston",
    state: f.state || "TX",
    neighborhood: f.neighborhood || null,
    minRent: parseInt(f.minRent) || 0,
    maxRent: f.maxRent ? parseInt(f.maxRent) : null,
    bedrooms: f.bedrooms ? parseInt(f.bedrooms) : null,
    bathrooms: f.bathrooms ? parseInt(f.bathrooms) : null,
    minSqft: f.minSqft ? parseInt(f.minSqft) : null,
    maxSqft: f.maxSqft ? parseInt(f.maxSqft) : null,
    builtYear: f.builtYear ? parseInt(f.builtYear) : null,
    availability: f.availability || null,
    primaryImageUrl: f.primaryImageUrl || null,
    imageUrls: f.imageUrls || null,
    special: f.special || null,
    featureHighlights: f.featureHighlights || null,
    exteriorAmenities: f.exteriorAmenities || null,
    interiorAmenities: f.interiorAmenities || null,
    petPolicy: f.petPolicy || null,
    managedBy: f.managedBy || null,
    latitude: f.latitude || null,
    longitude: f.longitude || null,
    isActive: 1 as const,
    sortOrder: parseInt(f.sortOrder) || 0,
  };
}

export default function AdminListings() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = !loading && !!user && user.role === "admin";

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const { data: allListings = [], isLoading } = trpc.listings.list.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  const createMutation = trpc.listings.create.useMutation({
    onSuccess: () => {
      toast.success("Listing created successfully");
      utils.listings.list.invalidate();
      setShowForm(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.listings.update.useMutation({
    onSuccess: () => {
      toast.success("Listing updated successfully");
      utils.listings.list.invalidate();
      setShowForm(false);
      setEditingListing(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.listings.delete.useMutation({
    onSuccess: () => {
      toast.success("Listing deleted");
      utils.listings.list.invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.listings.toggleActive.useMutation({
    onSuccess: () => utils.listings.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const uploadPhotoMutation = trpc.listings.uploadPhoto.useMutation({
    onSuccess: (data) => {
      setForm((f) => ({ ...f, primaryImageUrl: data.url }));
      toast.success("Photo uploaded successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5 MB");
      return;
    }

    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadPhotoMutation.mutateAsync({
          filename: file.name,
          mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
          base64Data: base64,
        });
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openCreate = () => {
    setEditingListing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (listing: Listing) => {
    setEditingListing(listing);
    setForm(listingToForm(listing));
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name || !form.minRent) {
      toast.error("Name and minimum rent are required");
      return;
    }
    const input = formToInput(form);
    if (editingListing) {
      updateMutation.mutate({ id: editingListing.id, ...input });
    } else {
      createMutation.mutate(input);
    }
  };

  const filtered = allListings.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.neighborhood ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (l.city ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Apartment Listings
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {allListings.length} admin-managed listing{allListings.length !== 1 ? "s" : ""} ·
              CSV baseline: 508 listings (read-only)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => utils.listings.list.invalidate()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Listing
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, neighborhood, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading listings...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <Building2 className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground text-sm">
                  {search
                    ? "No listings match your search."
                    : "No admin listings yet. Click \"Add Listing\" to create your first one."}
                </p>
                {!search && (
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Listing
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Photo</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Rent</TableHead>
                      <TableHead>Beds/Baths</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((listing) => (
                      <TableRow key={listing.id}>
                        <TableCell>
                          {listing.primaryImageUrl ? (
                            <img
                              src={listing.primaryImageUrl}
                              alt={listing.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{listing.name}</div>
                          {listing.propertyId && (
                            <div className="text-xs text-muted-foreground">
                              Override: #{listing.propertyId}
                            </div>
                          )}
                          {listing.special && (
                            <div className="text-xs text-yellow-600 mt-0.5 truncate max-w-[200px]">
                              ✨ {listing.special}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{listing.neighborhood || listing.city}</div>
                          <div className="text-xs text-muted-foreground">
                            {listing.city}, {listing.state}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          ${listing.minRent.toLocaleString()}
                          {listing.maxRent ? `–$${listing.maxRent.toLocaleString()}` : ""}
                          <div className="text-xs text-muted-foreground">/mo</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {listing.bedrooms != null ? `${listing.bedrooms} bd` : "—"}
                          {listing.bathrooms != null ? ` / ${listing.bathrooms} ba` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={listing.isActive ? "default" : "secondary"}
                            className="cursor-pointer select-none"
                            onClick={() =>
                              toggleMutation.mutate({
                                id: listing.id,
                                isActive: !listing.isActive,
                              })
                            }
                          >
                            {listing.isActive ? (
                              <>
                                <Eye className="w-3 h-3 mr-1" />
                                Active
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 mr-1" />
                                Hidden
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(listing)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(listing)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">How Admin Listings Work</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>
              Admin listings are merged with the 508-listing CSV at search time. If a listing has a
              <strong> Property ID</strong> matching a CSV row, it overrides that CSV entry. New
              listings (no Property ID) appear as additional results.
            </p>
            <p>
              Toggle <strong>Active/Hidden</strong> to show or hide a listing from the search page
              without deleting it. Hidden listings are still visible here.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingListing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingListing ? `Edit: ${editingListing.name}` : "Add New Listing"}
            </DialogTitle>
            <DialogDescription>
              {editingListing
                ? "Update the apartment listing details below."
                : "Fill in the details for the new apartment listing."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* Basic Info */}
            <div className="col-span-2">
              <Label htmlFor="name">Property Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. The Carlton at Midtown"
              />
            </div>

            <div>
              <Label htmlFor="minRent">Min Rent ($/mo) *</Label>
              <Input
                id="minRent"
                type="number"
                value={form.minRent}
                onChange={(e) => setForm((f) => ({ ...f, minRent: e.target.value }))}
                placeholder="1500"
              />
            </div>

            <div>
              <Label htmlFor="maxRent">Max Rent ($/mo)</Label>
              <Input
                id="maxRent"
                type="number"
                value={form.maxRent}
                onChange={(e) => setForm((f) => ({ ...f, maxRent: e.target.value }))}
                placeholder="2500"
              />
            </div>

            <div>
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                value={form.bedrooms}
                onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))}
                placeholder="1"
              />
            </div>

            <div>
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input
                id="bathrooms"
                type="number"
                value={form.bathrooms}
                onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))}
                placeholder="1"
              />
            </div>

            <div>
              <Label htmlFor="neighborhood">Neighborhood</Label>
              <Input
                id="neighborhood"
                value={form.neighborhood}
                onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
                placeholder="Midtown"
              />
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Houston"
              />
            </div>

            <div>
              <Label htmlFor="address">Address (internal only)</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St"
              />
            </div>

            <div>
              <Label htmlFor="availability">Availability</Label>
              <Input
                id="availability"
                value={form.availability}
                onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
                placeholder="1x1, 2x2"
              />
            </div>

            <div>
              <Label htmlFor="builtYear">Year Built</Label>
              <Input
                id="builtYear"
                type="number"
                value={form.builtYear}
                onChange={(e) => setForm((f) => ({ ...f, builtYear: e.target.value }))}
                placeholder="2018"
              />
            </div>

            <div>
              <Label htmlFor="minSqft">Min Sqft</Label>
              <Input
                id="minSqft"
                type="number"
                value={form.minSqft}
                onChange={(e) => setForm((f) => ({ ...f, minSqft: e.target.value }))}
                placeholder="650"
              />
            </div>

            <div>
              <Label htmlFor="maxSqft">Max Sqft</Label>
              <Input
                id="maxSqft"
                type="number"
                value={form.maxSqft}
                onChange={(e) => setForm((f) => ({ ...f, maxSqft: e.target.value }))}
                placeholder="1200"
              />
            </div>

            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="29.7604"
              />
            </div>

            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="-95.3698"
              />
            </div>

            {/* Photo Upload */}
            <div className="col-span-2">
              <Label>Primary Photo</Label>
              <div className="flex items-center gap-3 mt-1">
                {form.primaryImageUrl && (
                  <img
                    src={form.primaryImageUrl}
                    alt="Preview"
                    className="w-16 h-16 rounded object-cover border"
                  />
                )}
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto || uploadPhotoMutation.isPending}
                  >
                    {uploadingPhoto || uploadPhotoMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ImagePlus className="w-4 h-4 mr-2" />
                    )}
                    Upload Photo
                  </Button>
                  <Input
                    value={form.primaryImageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, primaryImageUrl: e.target.value }))}
                    placeholder="Or paste image URL..."
                    className="text-xs"
                  />
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
            </div>

            <div className="col-span-2">
              <Label htmlFor="special">Move-in Special</Label>
              <Input
                id="special"
                value={form.special}
                onChange={(e) => setForm((f) => ({ ...f, special: e.target.value }))}
                placeholder="e.g. $500 off first month"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="featureHighlights">Feature Highlights</Label>
              <Textarea
                id="featureHighlights"
                value={form.featureHighlights}
                onChange={(e) => setForm((f) => ({ ...f, featureHighlights: e.target.value }))}
                placeholder="Pool, Gym, Rooftop terrace..."
                rows={2}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="interiorAmenities">Interior Amenities</Label>
              <Textarea
                id="interiorAmenities"
                value={form.interiorAmenities}
                onChange={(e) => setForm((f) => ({ ...f, interiorAmenities: e.target.value }))}
                placeholder="Granite countertops, Stainless appliances..."
                rows={2}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="exteriorAmenities">Exterior Amenities</Label>
              <Textarea
                id="exteriorAmenities"
                value={form.exteriorAmenities}
                onChange={(e) => setForm((f) => ({ ...f, exteriorAmenities: e.target.value }))}
                placeholder="Covered parking, Dog park..."
                rows={2}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="petPolicy">Pet Policy</Label>
              <Input
                id="petPolicy"
                value={form.petPolicy}
                onChange={(e) => setForm((f) => ({ ...f, petPolicy: e.target.value }))}
                placeholder="Cats and dogs allowed, max 50 lbs"
              />
            </div>

            <div>
              <Label htmlFor="managedBy">Managed By</Label>
              <Input
                id="managedBy"
                value={form.managedBy}
                onChange={(e) => setForm((f) => ({ ...f, managedBy: e.target.value }))}
                placeholder="Habitat Locators"
              />
            </div>

            <div>
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                placeholder="0"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="propertyId">CSV Property ID (override)</Label>
              <Input
                id="propertyId"
                value={form.propertyId}
                onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                placeholder="Leave blank for new listing, or enter CSV property_id to override"
              />
              <p className="text-xs text-muted-foreground mt-1">
                If set, this listing replaces the matching CSV entry in search results.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowForm(false); setEditingListing(null); }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingListing ? (
                "Save Changes"
              ) : (
                "Create Listing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
