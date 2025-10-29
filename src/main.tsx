import React from "react";
import ReactDOM from "react-dom/client";
import { worker } from "./mocks/browser.ts";
import App from "./App.tsx";
import "./index.css";

worker.start({
  onUnhandledRequest: "bypass",
  quiet: !import.meta.env.DEV,
});

const root = ReactDOM.createRoot(document.getElementById("root")!);

React.startTransition(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
