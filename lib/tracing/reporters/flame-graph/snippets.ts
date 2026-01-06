import { html } from "./utilities";

interface SVGElementProps {
  width?: string | undefined | number;
  height?: string | undefined | number;
  class?: string | undefined | string[];
  style?: string | undefined | Record<string, string>;
}

export function usolateLayout(
  _strings: TemplateStringsArray,
  children: string,
  svgProps: SVGElementProps = {}
) {
  const {
    width = "100%",
    height = "100%",
    class: className = "",
    style = "",
  } = svgProps;

  const classNameString =
    typeof className === "string" ? className : className.join(" ");

  const styleString =
    typeof style === "string"
      ? style
      : Object.entries(style)
          .map(([key, value]) => `${key}: ${value}`)
          .join(";");

  return html`
    <svg
      width="${width}"
      height="${height}"
      class="${classNameString}"
      style="${styleString}"
    >
      <foreignObject
        width="100%"
        height="100%"
        style="width: 100%; height: 100%"
      >
        ${children}
      </foreignObject>
    </svg>
  `;
}

export function template(strings: TemplateStringsArray, ...values: any[]) {
  return strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
}
