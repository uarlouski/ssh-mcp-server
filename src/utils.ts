import { homedir } from 'os';
import { join } from 'path';

/**
 * Expands tilde (~) in file paths to the user's home directory
 * @param path The path to expand
 * @returns The expanded path
 */
export function expandTilde(path: string): string {
  return path.startsWith('~/')
    ? join(homedir(), path.slice(2))
    : path;
}

/**
 * Validates that a value is a non-empty string
 * @param value The value to validate
 * @param paramName The parameter name for error message
 * @throws Error if validation fails
 */
export function validateRequiredString(value: unknown, paramName: string): asserts value is string {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${paramName} is required and must be a non-empty string`);
  }
}

/**
 * Validates that a value is a valid octal permission string
 * @param value The value to validate
 * @throws Error if validation fails
 */
export function validatePermissions(value: string): void {
  if (typeof value !== 'string' || !/^0?[0-7]{3,4}$/.test(value)) {
    throw new Error('permissions must be a valid octal string (e.g., "0644", "755")');
  }
}
