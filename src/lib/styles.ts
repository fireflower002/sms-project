import { CSSProperties } from 'react';

type StyleObject = { [key: string]: CSSProperties };

export function createStyles<T extends StyleObject>(styles: T): T {
  return styles;
}
