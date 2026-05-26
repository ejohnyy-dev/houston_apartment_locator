export type NeighborhoodSlug =
  | "downtown-houston-apartments"
  | "midtown-houston-apartments"
  | "the-heights-apartments"
  | "galleria-apartments"
  | "medical-center-apartments";

export type Neighborhood = {
  slug: NeighborhoodSlug;
  title: string;
  eyebrow: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  rent: string;
  commute: string;
  lifestyle: string;
  specials: string;
  nearby: string[];
  cta: string;
};

export const neighborhoods: Record<NeighborhoodSlug, Neighborhood> = {
  "downtown-houston-apartments": {
    slug: "downtown-houston-apartments",
    title: "Downtown Houston Apartments",
    eyebrow: "Urban high-rises, walkability, and skyline views",
    metaTitle: "Downtown Houston Apartments | Free Locator Service | Habitat",
    metaDescription:
      "Find Downtown Houston apartments with Habitat Apartment Locators. Free apartment locator service for high-rises, move-in specials, and walkable Houston living.",
    intro:
      "Downtown Houston is built for renters who want the city at their front door. You get quick access to offices, sports venues, restaurants, Discovery Green, and the METRORail without giving up modern amenities.",
    rent: "Studios and one-bedroom apartments often start near the mid-$1,000s, with luxury one-bedrooms commonly landing around $1,800 to $2,200. Premium high-rise floor plans and larger units can run higher depending on views, parking, and building age.",
    commute:
      "Downtown is one of Houston's easiest neighborhoods for car-light living. The Red, Green, and Purple METRORail lines connect you to Midtown, the Museum District, the Medical Center, EaDo, and major downtown destinations.",
    lifestyle:
      "Expect high-rise living, rooftop pools, concierge-style amenities, walkable restaurants, and fast access to theaters, sports, parks, and major employers.",
    specials:
      "Downtown properties frequently compete with 4 to 8 weeks free, waived app/admin fees, parking incentives, or locator-only concessions on select floor plans.",
    nearby: [
      "Discovery Green",
      "Theater District",
      "Minute Maid Park",
      "Toyota Center",
      "METRORail",
    ],
    cta: "Tell me your budget, parking needs, and commute target. I will narrow Downtown to the buildings that actually fit.",
  },
  "midtown-houston-apartments": {
    slug: "midtown-houston-apartments",
    title: "Midtown Houston Apartments",
    eyebrow: "Nightlife, transit, and quick inner-loop access",
    metaTitle: "Midtown Houston Apartments | Free Locator Service | Habitat",
    metaDescription:
      "Find Midtown Houston apartments with a free Houston apartment locator. Compare walkable buildings, move-in specials, nightlife access, and commute options.",
    intro:
      "Midtown is a practical choice for renters who want quick access to Downtown, Montrose, the Medical Center, and Houston nightlife. It has a mix of newer mid-rises, townhome-style communities, and value pockets.",
    rent: "One-bedroom apartments in Midtown often range from about $1,500 to $1,900, with two-bedrooms commonly sitting around $2,100 to $2,800 depending on location, age, and amenity package.",
    commute:
      "Midtown sits between Downtown and the Museum District, with strong access to US-59, I-45, and the METRORail Red Line. It is one of the easier neighborhoods for commuters who split time across the inner loop.",
    lifestyle:
      "Midtown works well if you want restaurants, bars, gyms, coffee shops, and quick Uber rides without paying top-tier high-rise pricing.",
    specials:
      "Midtown communities often offer 4 to 6 weeks free, reduced deposits, and look-and-lease specials when inventory is high.",
    nearby: [
      "Midtown Park",
      "METRORail Red Line",
      "Montrose",
      "Downtown",
      "Museum District",
    ],
    cta: "Send me your preferred move date and budget and I will sort Midtown options by walkability, noise level, and actual value.",
  },
  "the-heights-apartments": {
    slug: "the-heights-apartments",
    title: "The Heights Houston Apartments",
    eyebrow: "Historic charm with newer apartment communities",
    metaTitle:
      "The Heights Houston Apartments | Free Locator Service | Habitat",
    metaDescription:
      "Find apartments in The Heights Houston with Habitat Apartment Locators. Free apartment search help for walkable Houston Heights living and current specials.",
    intro:
      "The Heights blends older Houston character with newer apartment communities, restaurants, trails, and neighborhood retail. It is one of the strongest choices if you want an inner-loop feel without living downtown.",
    rent: "One-bedroom apartments in The Heights often range from around $1,600 to $2,200. Boutique communities and newer buildings with premium finishes can price higher, especially near popular retail corridors.",
    commute:
      "The Heights gives you fast access to I-10, I-45, Washington Avenue, Downtown, and the Energy Corridor. Parking and traffic patterns vary a lot by building, so building selection matters.",
    lifestyle:
      "Expect local restaurants, coffee shops, trails, patio dining, and a quieter residential feel than Midtown or Downtown.",
    specials:
      "Newer communities in and around The Heights may offer 4 to 6 weeks free, waived fees, or reduced deposits to fill select units.",
    nearby: [
      "19th Street",
      "Heights Hike and Bike Trail",
      "White Oak",
      "Washington Avenue",
      "Downtown",
    ],
    cta: "I will help you separate true Heights value from listings that only borrow the name while sitting outside your target area.",
  },
  "galleria-apartments": {
    slug: "galleria-apartments",
    title: "Galleria and Uptown Houston Apartments",
    eyebrow: "Luxury towers, shopping, and central west-side access",
    metaTitle: "Galleria Houston Apartments | Free Locator Service | Habitat",
    metaDescription:
      "Find Galleria and Uptown Houston apartments with a free apartment locator. Compare luxury high-rises, move-in specials, parking, and commute options.",
    intro:
      "The Galleria and Uptown area is one of Houston's best-known apartment markets, with luxury towers, established garden-style communities, shopping, restaurants, and strong access to major employment centers.",
    rent: "One-bedroom apartments near the Galleria often range from about $1,600 to $2,500, with premium high-rises and larger floor plans moving well above that depending on finishes and views.",
    commute:
      "The area gives you practical access to 610, US-59, Westheimer, River Oaks, Greenway Plaza, and the Energy Corridor. Traffic can be heavy, so garage access and commute pattern matter.",
    lifestyle:
      "This is a strong fit for renters who want shopping, dining, polished amenity packages, and a central location west of Downtown.",
    specials:
      "Because the Galleria has a lot of apartment inventory, select buildings may offer aggressive concessions, including 6 to 8 weeks free or parking incentives.",
    nearby: [
      "The Galleria",
      "Uptown Park",
      "Gerald D. Hines Waterwall Park",
      "River Oaks",
      "Greenway Plaza",
    ],
    cta: "I will compare Galleria buildings by real monthly cost after specials, parking, fees, and commute tradeoffs.",
  },
  "medical-center-apartments": {
    slug: "medical-center-apartments",
    title: "Medical Center Houston Apartments",
    eyebrow: "Convenient apartments near TMC, NRG, and Rice",
    metaTitle:
      "Medical Center Houston Apartments | Free Locator Service | Habitat",
    metaDescription:
      "Find apartments near the Texas Medical Center with Habitat Apartment Locators. Free search help for healthcare workers, students, and relocating renters.",
    intro:
      "The Texas Medical Center area is built around convenience. Renters here often prioritize commute time, parking, flexible lease timing, and access to TMC, Rice, NRG, Hermann Park, and the Museum District.",
    rent: "One-bedroom apartments near the Medical Center commonly range from about $1,400 to $2,000, while two-bedrooms often land from the low-$2,000s upward depending on proximity and amenities.",
    commute:
      "Many properties sit within a short drive, shuttle ride, bike ride, or METRORail trip of major hospitals and schools. The right building can save meaningful time every week.",
    lifestyle:
      "The area fits healthcare professionals, fellows, students, travel nurses, and renters who want easy access to Hermann Park, the Museum District, and central Houston.",
    specials:
      "Medical Center communities often offer healthcare-worker incentives, waived fees, flexible lease terms, and periodic free-rent specials on selected units.",
    nearby: [
      "Texas Medical Center",
      "MD Anderson",
      "Hermann Park",
      "Rice University",
      "NRG Stadium",
    ],
    cta: "Send me your work or school location and shift pattern. I will prioritize buildings that make the daily routine easier.",
  },
};

export const neighborhoodList = Object.values(neighborhoods);
