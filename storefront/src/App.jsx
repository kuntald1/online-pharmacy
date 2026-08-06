import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChannelProvider } from "./context/ChannelContext";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";

import HomeB2C from "./pages/HomeB2C";
import B2BWholesale from "./pages/B2BWholesale";
import CNF from "./pages/CNF";
import AllCategories from "./pages/AllCategories";
import AllOffers from "./pages/AllOffers";
import AllBrands from "./pages/AllBrands";
import CategoryProducts from "./pages/CategoryProducts";
import BrandProducts from "./pages/BrandProducts";
import Wishlist from "./pages/Wishlist";
import Profile from "./pages/Profile";
import MyReturns from "./pages/MyReturns";
import Wallet from "./pages/Wallet";
import SearchResults from "./pages/SearchResults";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import OrderHistory from "./pages/OrderHistory";
import Invoice from "./pages/Invoice";

export default function App() {
  return (
    <BrowserRouter>
      <ChannelProvider>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/" element={<HomeB2C />} />
              <Route path="/b2c" element={<HomeB2C />} />
              <Route path="/b2b" element={<B2BWholesale />} />
              <Route path="/cnf" element={<CNF />} />
              <Route path="/:channelParam/categories" element={<AllCategories />} />
              <Route path="/:channelParam/category/:slug" element={<CategoryProducts />} />
              <Route path="/:channelParam/offers" element={<AllOffers />} />
              <Route path="/:channelParam/brands" element={<AllBrands />} />
              <Route path="/:channelParam/brand/:slug" element={<BrandProducts />} />
              <Route path="/:channelParam/wishlist" element={<Wishlist />} />
              <Route path="/:channelParam/profile" element={<Profile />} />
              <Route path="/:channelParam/returns" element={<MyReturns />} />
              <Route path="/:channelParam/wallet" element={<Wallet />} />
              <Route path="/:channelParam/search" element={<SearchResults />} />
              <Route path="/:channelParam/product/:slug" element={<ProductDetail />} />
              <Route path="/:channelParam/checkout" element={<Checkout />} />
              <Route path="/:channelParam/orders" element={<OrderHistory />} />
              <Route path="/:channelParam/orders/:orderId/invoice" element={<Invoice />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </ChannelProvider>
    </BrowserRouter>
  );
}
