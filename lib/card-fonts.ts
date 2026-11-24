import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Fonts do not depend on the request, so they are read once when the module loads.
export const cardFonts = Promise.all(
  ([['Regular', 400], ['Medium', 500], ['SemiBold', 600]] as const).map(async ([file, weight]) => ({
    name: 'Libre Franklin', weight, style: 'normal' as const,
    data: await readFile(join(process.cwd(), `assets/fonts/LibreFranklin-${file}.ttf`))
  }))
);
