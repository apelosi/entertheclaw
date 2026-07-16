import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
/** Always matches mcp/package.json — do not hardcode elsewhere. */
export const MCP_PACKAGE_VERSION = require('../package.json').version;
