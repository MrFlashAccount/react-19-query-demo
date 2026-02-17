import "./index.css";
import "virtual:rsc-prism/main-thread-modules";

import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";
import { Loader } from "./components/shared/Loader.tsx";
import { RuntimeBootstrap } from "./RuntimeBootstrap.tsx";

const root = ReactDOM.createRoot(document.getElementById("root")!);

React.startTransition(() => {
  root.render(
    <React.StrictMode>
      <Suspense fallback={<Loader />}>
        <RuntimeBootstrap />
        <Suspense fallback={<Loader />}>
          <App />
        </Suspense>
      </Suspense>
    </React.StrictMode>,
  );
});
