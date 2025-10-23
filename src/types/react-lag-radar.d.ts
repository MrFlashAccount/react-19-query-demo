declare module "react-lag-radar" {
  import { ComponentType } from "react";

  interface LagRadarProps {
    size?: number;
    inset?: number;
    frames?: number;
  }

  const LagRadar: ComponentType<LagRadarProps>;
  export default LagRadar;
}
