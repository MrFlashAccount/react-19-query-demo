import "./index.css";

import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";
import { Loader } from "./components/shared/Loader.tsx";
import { SwLoader } from "./SwLoader.tsx";

const root = ReactDOM.createRoot(document.getElementById("root")!);

React.startTransition(() => {
  root.render(
    <React.StrictMode>
      <Suspense fallback={<Loader />}>
        <SwLoader />
        <Suspense fallback={<Loader />}>
          <App />
        </Suspense>
      </Suspense>
    </React.StrictMode>,
  );
});
