import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const renderer = ReactDOM.createRoot(document.getElementById("root")!);

React.startTransition(() => {
  renderer.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
