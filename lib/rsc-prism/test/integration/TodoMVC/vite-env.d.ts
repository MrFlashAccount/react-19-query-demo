declare module "virtual:rsc-prism/worker-bootstrap" {
  import type { RSCTransport } from "@lib/rsc-prism/client-only";

  export interface BootstrappedWorkerRuntime {
    worker: Worker;
    transport: RSCTransport;
    dispose: () => void;
  }

  export function bootstrapWorkerRuntime(): Promise<BootstrappedWorkerRuntime>;
}
