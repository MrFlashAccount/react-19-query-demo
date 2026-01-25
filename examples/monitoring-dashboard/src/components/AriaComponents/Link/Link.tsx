import { Button, type LinkProps } from "../Button";

export function Link<IconType extends string>(props: LinkProps<IconType>) {
  return <Button variant="link" {...props} />;
}

export type { LinkProps };
