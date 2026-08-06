import { useEffect, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import HeroSlider from "../components/HeroSlider";
import CategoryGrid from "../components/CategoryGrid";
import BrandStrip from "../components/BrandStrip";
import ProductGrid from "../components/ProductGrid";
import HealthPackagesRow from "../components/HealthPackagesRow";
import PromoStrip from "../components/PromoStrip";
import ChannelCards from "../components/ChannelCards";
import TrustBadges from "../components/TrustBadges";
import Section from "../components/Section";
import ChannelModal from "../components/ChannelModal";
import { useChannel } from "../context/ChannelContext";

export default function HomeB2C() {
  const { channel, setChannel } = useChannel();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setChannel("b2c");
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header onLogoClick={() => setShowModal(true)} />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
          <HeroSlider channel="b2c" />
        </div>

        <Section title="Shop by Category">
          <CategoryGrid channel="b2c" />
        </Section>

        <Section title="">
          <PromoStrip channel="b2c" />
        </Section>

        <Section title="Discover New Brands">
          <BrandStrip channel="b2c" />
        </Section>

        <Section title="Popular Medicines">
          <ProductGrid channel="b2c" />
        </Section>

        <Section title="Popular Health Packages">
          <HealthPackagesRow channel="b2c" />
        </Section>

        <Section title="">
          <ChannelCards channel="b2c" />
        </Section>
      </main>

      <TrustBadges />
      <Footer />

      {showModal && <ChannelModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
