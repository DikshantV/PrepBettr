/**
 * MSW Server Setup for Node.js Tests
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup server with our handlers
export const server = setupServer(...handlers);
