import Hero from "../components/home/HeroSection";
import TrustBar from "../components/home/TrustStrip";
import FeaturedListings from "../components/home/FeaturedListings";
import StudentBenefits from "../components/home/StudentBenefits";
import LandlordBenefits from "../components/home/LandlordBenefits";
import HowItWorks from "../components/home/HowItWorks";
import Mission from "../components/home/Mission";
import TrustSafety from "../components/home/TrustSafety";
import Testimonials from "../components/home/Testimonials";
import FinalCTA from "../components/home/FinalCTA";
import HomeFooter from "../components/home/HomeFooter";
import { createClient } from "../lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select(`
      id,
      title,
      city,
      campus,
      price,
      bedrooms,
      bathrooms,
      status,
      is_featured,
      listing_images (
        image_url,
        is_cover,
        sort_order
      )
    `)
    .eq("status", "available")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Hero />
      <TrustBar />
      <FeaturedListings listings={listings || []} />
      <StudentBenefits />
      <LandlordBenefits />
      <TrustSafety />
      <HowItWorks />
      <Mission />
      <Testimonials />
      <FinalCTA />
      <HomeFooter />
    </main>
  );
}