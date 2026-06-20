import { expect } from 'chai';
import { handleConnection } from '../src/ws-handler.js';

describe('ws-handler', () => {
  it('should handle transcript message', async () => {
    const mockWs = {
      on: (event, callback) => {
        if (event === 'message') {
          callback(JSON.stringify({ type: 'transcript', text: 'turn on the light' }));
        }
      },
      send: (msg) => {
        const response = JSON.parse(msg);
        expect(response.type).to.equal('response');
      }
    };
    handleConnection(mockWs);
  });
});
