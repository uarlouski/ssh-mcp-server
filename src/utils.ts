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
