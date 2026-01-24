/**
 * @file
 *
 * Isolates the layout of the children from the rest of the page.
 * Improves Layout recalculation performance.
 */
import { useMeasureCallback } from "#/hooks/measureHooks";
import { useRef, type ReactNode } from "react";
import { mergeRefs } from "../utilities/mergeRefs";
import { tv } from "../utilities/tailwindVariants";
import type { RefProp } from "#/components/AriaComponents/types";

/**
 * Props for the {@link IsolateLayout} component.
 */
export interface IsolateLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly useRAF?: boolean;
  readonly debounce?: number;
  readonly maxWait?: number;
  readonly children: ReactNode;
}

const ISOLATE_LAYOUT_VARIANTS = tv({ base: "contain-strict" });
const DEBOUNCE_TIME = 16;

/**
 * Isolates the layout of the children from the rest of the page, using SVG + foreignObject hack.
 * Improves Layout recalculation performance.
 */
export function IsolateLayout(props: IsolateLayoutProps & RefProp<HTMLDivElement>) {
  const {
    className,
    children,
    style,
    useRAF = false,
    debounce = DEBOUNCE_TIME,
    maxWait = DEBOUNCE_TIME,
    ref: forwardedRef,
    ...rest
  } = props;

  const [measureRef] = useMeasureCallback({
    onResize: ({ width, height }) => {
      if (svgRef.current) {
        svgRef.current.style.width = `${width}px`;
        svgRef.current.style.height = `${height}px`;
      }

      if (foreignObjectRef.current) {
        foreignObjectRef.current.style.width = `${width}px`;
        foreignObjectRef.current.style.height = `${height}px`;
      }
    },
    debounce,
    maxWait,
    useRAF,
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const foreignObjectRef = useRef<SVGForeignObjectElement>(null);

  const classes = ISOLATE_LAYOUT_VARIANTS({ className });

  return (
    <div
      ref={(node) => {
        mergeRefs(forwardedRef, measureRef)(node);
      }}
      className={classes}
      style={style}
      {...rest}
    >
      <svg ref={svgRef} width="100%" height="100%">
        <foreignObject ref={foreignObjectRef}>{children}</foreignObject>
      </svg>
    </div>
  );
}
