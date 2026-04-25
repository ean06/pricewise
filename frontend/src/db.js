import Dexie from 'dexie';

export const db = new Dexie('PriceWiseDB');
db.version(1).stores({
  pencarian: 'keyword, data, timestamp'
});