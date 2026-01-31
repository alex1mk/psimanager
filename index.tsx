import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./src/styles/daypicker.css";
import moment from "moment";
import "moment/locale/pt-br";

moment.locale("pt-br");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
