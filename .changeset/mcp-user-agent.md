---
"creem": patch
---

MCP server now sends a distinct `creem-mcp/<version>` User-Agent prefix (ahead of the default Speakeasy SDK UA) so MCP-originated API traffic is attributable in server-side logs, separately from CLI and direct SDK usage.
