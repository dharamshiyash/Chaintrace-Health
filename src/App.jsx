import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav.jsx";
import Landing from "./pages/Landing.jsx";
import Verify from "./pages/Verify.jsx";
import ManufacturerDashboard from "./pages/ManufacturerDashboard.jsx";
import DistributorDashboard from "./pages/DistributorDashboard.jsx";
import PharmacyDashboard from "./pages/PharmacyDashboard.jsx";

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/verify/:batchId?" element={<Verify />} />
        <Route path="/dashboard/manufacturer" element={<ManufacturerDashboard />} />
        <Route path="/dashboard/distributor" element={<DistributorDashboard />} />
        <Route path="/dashboard/pharmacy" element={<PharmacyDashboard />} />
      </Routes>
    </>
  );
}
