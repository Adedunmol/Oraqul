import { QlooClient, searchEntity } from '../src';

const apiKey = process.env.QLOO_API_KEY;
const baseUrl = process.env.QLOO_BASE_URL;

if (!apiKey || !baseUrl) {
  console.log('Skipping Qloo smoke test: QLOO_API_KEY and QLOO_BASE_URL are not set');
  process.exit(0);
}

const client = new QlooClient({ apiKey, baseUrl });
const { data, receipt } = await searchEntity(client, 'Burna Boy', 'urn:entity:artist');
console.log(JSON.stringify({ data, receipt }, null, 2));
