import { test, strict as assert } from 'node:test';
import { z } from 'zod';

// Mirror of LoginSchema used in the page
const LoginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

test('LoginSchema validates correct payload', () => {
  const result = LoginSchema.safeParse({ email: 'user@example.com', password: 'secret12' });
  assert.equal(result.success, true);
});

test('LoginSchema rejects invalid email', () => {
  const result = LoginSchema.safeParse({ email: 'bad', password: 'secret12' });
  assert.equal(result.success, false);
});

test('LoginSchema rejects short password', () => {
  const result = LoginSchema.safeParse({ email: 'user@example.com', password: '123' });
  assert.equal(result.success, false);
});