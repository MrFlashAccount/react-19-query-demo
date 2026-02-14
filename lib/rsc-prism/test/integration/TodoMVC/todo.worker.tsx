/// <reference lib="webworker" />

import { createWorkerRuntime } from "@lib/rsc-prism/worker-runtime";

import * as todoActions from "./todo-actions";
import * as workerComponents from "./worker-components";

createWorkerRuntime({
  componentModules: [{ moduleId: "worker-components.tsx", moduleExports: workerComponents }],
  actionModules: [{ moduleId: "todo-actions.ts", moduleExports: todoActions }],
});
