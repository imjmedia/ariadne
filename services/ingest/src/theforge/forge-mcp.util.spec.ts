import { describe, it, expect } from 'vitest';
import {
  extractMcpToolText,
  isForgeMcpEndpointUrl,
  normalizeForgeMcpUrl,
  parseMcpHttpBody,
  parseMcpToolJson,
} from './forge-mcp.util';

describe('forge-mcp.util', () => {
  it('detects MCP endpoint URLs', () => {
    expect(isForgeMcpEndpointUrl('https://maxprime.obp.mx/mcp')).toBe(true);
    expect(isForgeMcpEndpointUrl('https://maxprime.obp.mx/mcp/')).toBe(true);
    expect(isForgeMcpEndpointUrl('https://maxprime.obp.mx/api')).toBe(false);
  });

  it('normalizes MCP URL', () => {
    expect(normalizeForgeMcpUrl('https://maxprime.obp.mx/mcp/')).toBe('https://maxprime.obp.mx/mcp');
  });

  it('extracts tool text from JSON-RPC result', () => {
    const text = extractMcpToolText({
      result: { content: [{ type: 'text', text: '[{"id":"1"}]' }] },
    });
    expect(text).toBe('[{"id":"1"}]');
  });

  it('parses JSON tool payloads', () => {
    expect(parseMcpToolJson('[{"id":"abc"}]')).toEqual([{ id: 'abc' }]);
  });

  it('parses JSON-RPC from SSE body', () => {
    const rpc = parseMcpHttpBody(
      'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"ok"}]}}\n\n',
      'text/event-stream',
    );
    expect(extractMcpToolText(rpc)).toBe('ok');
  });
});
