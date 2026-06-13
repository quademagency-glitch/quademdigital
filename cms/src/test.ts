// dotenv removed
console.log('1. Removed dotenv');
import { getPayload } from 'payload';
console.log('2. Imported getPayload');
import config from './payload.config';
console.log('3. Imported config');

async function test() {
  console.log('4. Initializing payload...');
  const payload = await getPayload({ config });
  console.log('5. Payload initialized!');
  process.exit(0);
}

test().catch(console.error);
