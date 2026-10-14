import { rankCharts } from './DataMatch.js';
import { profileTable } from './profile.js';

self.onmessage = ({ data: table }) => {
  try {
    const ranked = rankCharts(table);
    const entries = (items) => items.map(({ def, table: unused, ...entry }) => ({ ...entry, id: def.id }));
    self.postMessage({
      ranked: { ...ranked, fits: entries(ranked.fits), partial: entries(ranked.partial), misses: entries(ranked.misses) },
      profile: profileTable(table),
    });
  } catch (error) {
    self.postMessage({ error: error.message || 'Could not analyze this table.' });
  }
};
