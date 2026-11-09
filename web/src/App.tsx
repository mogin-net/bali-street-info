import { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ReportList from "./components/report/reportList";
import ReportPage from "./pages/report/report";

function App() {
  const location = useLocation();

  return (
    <>
      <div>
        <Routes>
          <Route path="/" element={<ReportPage />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
