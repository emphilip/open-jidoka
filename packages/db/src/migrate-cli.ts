import { migrate } from './migrate';
import { closePool } from './pool';

await migrate();
await closePool();
