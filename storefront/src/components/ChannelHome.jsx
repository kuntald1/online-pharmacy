import HeroSlider from "./HeroSlider";
import CategoryGrid from "./CategoryGrid";
import BrandStrip from "./BrandStrip";
import PromoStrip from "./PromoStrip";
import ProductGrid from "./ProductGrid";
import HealthPackagesRow from "./HealthPackagesRow";
import ChannelCards from "./ChannelCards";
import Section from "./Section";

/**
 * channel: "b2c" | "b2b" | "cnf" — used directly for every section,
 * including the product grid. The backend resolves a generic "b2b" request
 * into both B2B pricing tiers (Normal + Advance) — there's no per-account
 * tier on file, so a B2B account sees both and picks per-item on the
 * product detail page, same idea as an MRP with two discount tiers shown
 * side by side rather than the storefront guessing which one applies.
 */
export default function ChannelHome({ channel, productTitle = "Popular Products" }) {
  return (
    <>
      <div className="mb-8">
        <HeroSlider channel={channel} />
      </div>

      <Section title="Shop by Category">
        <CategoryGrid channel={channel} />
      </Section>

      <Section title="">
        <PromoStrip channel={channel} />
      </Section>

      <Section title="Discover New Brands">
        <BrandStrip channel={channel} />
      </Section>

      <Section title={productTitle}>
        <ProductGrid channel={channel} />
      </Section>

      <Section title="Popular Health Packages">
        <HealthPackagesRow channel={channel} />
      </Section>

      <Section title="">
        <ChannelCards channel={channel} />
      </Section>
    </>
  );
}
