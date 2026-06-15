import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data.json');

const defaultData = { users: [], messages: [] };
const adapter = new JSONFile(dbPath);
const db = new Low(adapter, defaultData);

// Initialize and load
await db.read();
db.data ||= defaultData;
await db.write();

export default db;
