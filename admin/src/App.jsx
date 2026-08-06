import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Brands from "./pages/Brands";
import Banners from "./pages/Banners";
import HealthPackages from "./pages/HealthPackages";
import DeliveryZones from "./pages/DeliveryZones";
import B2BApplications from "./pages/B2BApplications";
import CNFLeads from "./pages/CNFLeads";
import Prescriptions from "./pages/Prescriptions";
import Returns from "./pages/Returns";
import B2COrders from "./pages/B2COrders";
import B2BOrders from "./pages/B2BOrders";
import CNFOrders from "./pages/CNFOrders";
import Customers from "./pages/Customers";
import Inventory from "./pages/Inventory";
import Reviews from "./pages/Reviews";
import Coupons from "./pages/Coupons";
import Marketing from "./pages/Marketing";
import Reports from "./pages/Reports";
import CMS from "./pages/CMS";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
          <Route path="/brands" element={<ProtectedRoute><Brands /></ProtectedRoute>} />
          <Route path="/banners" element={<ProtectedRoute><Banners /></ProtectedRoute>} />
          <Route path="/health-packages" element={<ProtectedRoute><HealthPackages /></ProtectedRoute>} />
          <Route path="/delivery-zones" element={<ProtectedRoute><DeliveryZones /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
          <Route path="/orders/b2c" element={<ProtectedRoute><B2COrders /></ProtectedRoute>} />
          <Route path="/orders/b2b" element={<ProtectedRoute><B2BOrders /></ProtectedRoute>} />
          <Route path="/orders/cnf" element={<ProtectedRoute><CNFOrders /></ProtectedRoute>} />
          <Route path="/b2b-applications" element={<ProtectedRoute><B2BApplications /></ProtectedRoute>} />
          <Route path="/cnf-leads" element={<ProtectedRoute><CNFLeads /></ProtectedRoute>} />
          <Route path="/prescriptions" element={<ProtectedRoute><Prescriptions /></ProtectedRoute>} />
          <Route path="/returns" element={<ProtectedRoute><Returns /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/coupons" element={<ProtectedRoute><Coupons /></ProtectedRoute>} />
          <Route path="/marketing" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/cms" element={<ProtectedRoute><CMS /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
