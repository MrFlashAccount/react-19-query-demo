import { lazy, startTransition, useEffect, useState } from "react";

const LazyLagRadar = lazy(() => import("react-lag-radar"));

export function LagRadar() {
  const readCoordinates = () => {
    const padding = 4;
    const { height } = window.visualViewport ?? {
      height: window.innerHeight,
    };

    let size = 120;

    if (height < window.innerHeight) {
      size = 60;
    }

    return { x: padding, y: height - size - padding, size };
  };

  const [position, setPosition] = useState(readCoordinates);

  useEffect(() => {
    const handleVisualViewportChange = () => {
      startTransition(() => {
        setPosition(readCoordinates());
      });
    };

    window.visualViewport?.addEventListener(
      "resize",
      handleVisualViewportChange
    );

    return () =>
      window.visualViewport?.removeEventListener(
        "visualviewportchange",
        handleVisualViewportChange
      );
  }, []);

  return (
    <div
      className="fixed z-50 bg-gray-900 rounded-full"
      style={{
        left: position.x,
        top: position.y,
        width: position.size,
        height: position.size,
      }}
    >
      <LazyLagRadar size={position.size} />
    </div>
  );
}
