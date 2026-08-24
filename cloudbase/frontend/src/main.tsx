import React from "react";
import ReactDOM from "react-dom/client";
import WeightApp from "../../../app/WeightApp";
import "../../../app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WeightApp user={null} />
  </React.StrictMode>,
);
