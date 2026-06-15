import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data.json');

const defaultData = {
  users: [],
  messages: [],
  rooms: [
    {
      id: 'general',
      name: 'General',
      description: 'Sala principal para todos',
      created_by: 'system',
      created_at: Date.now(),
      is_default: true
    }
  ]
};

const adapter = new JSONFile(dbPath);
const db = new Low(adapter, defaultData);

// Initialize and load
await db.read();

// Ensure all keys exist (migration)
db.data.users    ||= [];
db.data.messages ||= [];
db.data.rooms    ||= defaultData.rooms;

// Add default room if missing
if (!db.data.rooms.find(r => r.id === 'general')) {
  db.data.rooms.unshift(defaultData.rooms[0]);
}

await db.write();

export default db;
