import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SwLoader } from "./SwLoader.tsx";
import { Loader } from "./components/shared/Loader.tsx";

const root = ReactDOM.createRoot(document.getElementById("root")!);

React.startTransition(() => {
  root.render(
    <React.StrictMode>
      <Suspense fallback={<Loader />}>
        <App />
        <SwLoader />
      </Suspense>
    </React.StrictMode>
  );
});
