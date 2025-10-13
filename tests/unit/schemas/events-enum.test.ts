import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('stream-json-event.schema.json enums', () => {
  const schemaPath = join(process.cwd(), 'docs/schemas/stream-json-event.schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

  it('should include new Phase 1 events', () => {
    const enums: string[] = schema.properties.event.enum;
    expect(enums).toContain('plan_updated');
    expect(enums).toContain('progress_updated');
    expect(enums).toContain('checkpoint_saved');
  });
});
