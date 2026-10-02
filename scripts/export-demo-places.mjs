import { writeFile } from 'node:fs/promises';
import { PLACES } from '../src/data/places.js';

await writeFile(
  new URL('../api/demo_places.json', import.meta.url),
  `${JSON.stringify(PLACES, null, 2)}\n`,
  'utf8',
);
