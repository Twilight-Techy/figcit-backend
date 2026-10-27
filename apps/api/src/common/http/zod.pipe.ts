import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Parses a body, query or param with a zod schema; unknown fields are rejected by `.strict()` schemas. */
@Injectable()
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    return this.schema.parse(value);
  }
}
