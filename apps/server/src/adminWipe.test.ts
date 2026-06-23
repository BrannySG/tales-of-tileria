import { describe, expect, it } from 'vitest';
import {
  WIPE_CONFIRM,
  isAuthorizedAdminRequest,
  parseBearerToken,
  parseWipeScope,
} from './adminWipe';

describe('admin wipe helpers', () => {
  it('parses bearer tokens safely', () => {
    expect(parseBearerToken('Bearer abc123')).toBe('abc123');
    expect(parseBearerToken('bearer abc123')).toBe('abc123');
    expect(parseBearerToken('Token abc123')).toBeUndefined();
    expect(parseBearerToken(null)).toBeUndefined();
  });

  it('authorizes only matching bearer token', () => {
    expect(isAuthorizedAdminRequest(`Bearer ${WIPE_CONFIRM}`, WIPE_CONFIRM)).toBe(true);
    expect(isAuthorizedAdminRequest('Bearer nope', WIPE_CONFIRM)).toBe(false);
    expect(isAuthorizedAdminRequest('Token nope', WIPE_CONFIRM)).toBe(false);
    expect(isAuthorizedAdminRequest('Bearer anything', '')).toBe(false);
  });

  it('defaults and validates wipe scopes', () => {
    expect(parseWipeScope(undefined)).toBe('leaderboard');
    expect(parseWipeScope('leaderboard')).toBe('leaderboard');
    expect(parseWipeScope('router')).toBe('router');
    expect(parseWipeScope('all')).toBe('all');
    expect(parseWipeScope('')).toBe('leaderboard');
    expect(parseWipeScope('invalid')).toBeUndefined();
  });
});
