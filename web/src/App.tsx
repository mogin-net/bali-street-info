import { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ReportPage from "./pages/report/report";
import Home from "./pages/home/home";

function App() {
  const location = useLocation();

  return (
    <>
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
