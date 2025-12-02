import { parse } from 'shell-quote';

/**
 * CommandParser - Extracts all commands from complex shell command strings
 * 
 * Uses the shell-quote library for proper POSIX shell parsing.
 * 
 * Handles:
 * - Pipes: command1 | command2
 * - AND chains: command1 && command2
 * - OR chains: command1 || command2
 * - Semicolons: command1 ; command2
 * - Command substitution: $(command)
 * - Proper quote handling
 */
export class CommandParser {
  /**
   * Extract all base commands from a shell command string
   * @param commandString The full command string to parse
   * @returns Array of base commands (first word of each command)
   */
  static extractCommands(commandString: string): string[] {
    const outerCommands: string[] = [];
    const nestedCommands: string[] = [];
    const seen = new Set<string>();
    
    // Extract command substitutions $() before parsing (shell-quote doesn't handle these well)
    const extractDollarSubs = (str: string): { subs: string[], cleaned: string } => {
      const subs: string[] = [];
      let result = str;
      let i = 0;
      let offset = 0;
      
      while (i < str.length) {
        if (str[i] === '$' && str[i+1] === '(') {
          let depth = 1;
          let start = i + 2;
          let j = start;
          while (j < str.length && depth > 0) {
            if (str[j] === '(') depth++;
            if (str[j] === ')') depth--;
            j++;
          }
          if (depth === 0) {
            const sub = str.substring(start, j - 1);
            subs.push(sub);
            // Replace with placeholder
            const placeholder = `__SUB${subs.length - 1}__`;
            const before = result.substring(0, i - offset);
            const after = result.substring(j - offset);
            result = before + placeholder + after;
            offset += (j - i) - placeholder.length;
          }
          i = j;
        } else {
          i++;
        }
      }
      
      return { subs, cleaned: result };
    };
    
    // Handle backticks first (shell-quote doesn't parse these)
    const handleBackticks = (str: string): string => {
      const backtickPattern = /`([^`]+)`/g;
      let match;
      while ((match = backtickPattern.exec(str)) !== null) {
        // Extract commands from backtick content
        try {
          const parsed = parse(match[1]);
          collectFromTokens(parsed, nestedCommands);
        } catch {
          // Fallback for parsing errors
          const firstWord = match[1].trim().split(/\s+/)[0];
          if (firstWord) nestedCommands.push(firstWord);
        }
      }
      // Replace backticks with placeholder for main parsing
      return str.replace(/`[^`]+`/g, '');
    };
    
    // Function to collect commands from parsed tokens
    const collectFromTokens = (tokens: ReturnType<typeof parse>, targetArray: string[]) => {
      let expectingCommand = true;
      let sawSubstitution = false;
      
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        // Handle operator objects
        if (typeof token === 'object' && token !== null && 'op' in token) {
          expectingCommand = true;
          sawSubstitution = false;
          continue;
        }
        
        // Handle comment objects
        if (typeof token === 'object' && token !== null && 'comment' in token) {
          continue;
        }
        
        // Handle glob patterns (treat as arguments, not commands)
        if (typeof token === 'object' && token !== null && 'op' in token && token.op === 'glob') {
          continue;
        }
        
        // String tokens
        if (typeof token === 'string') {
          // Check if this is a substitution placeholder
          if (token.startsWith('__SUB')) {
            sawSubstitution = true;
            continue;
          }
          
          // If we're expecting a command, this is it
          if (expectingCommand && token && !token.startsWith('-')) {
            targetArray.push(token);
            expectingCommand = false;
          }
          // After a substitution, if we see a non-flag token, it might be a command argument
          else if (sawSubstitution && token && !token.startsWith('-')) {
            targetArray.push(token);
            sawSubstitution = false;
          }
          
          // Special handling for -- separator (everything after could be a command)
          if (token === '--' && i + 1 < tokens.length) {
            const nextToken = tokens[i + 1];
            if (typeof nextToken === 'string' && !nextToken.startsWith('-') && !nextToken.startsWith('__SUB')) {
              targetArray.push(nextToken);
            }
          }
        }
      }
    };
    
    // Pre-process backticks
    let processedString = handleBackticks(commandString);
    
    // Extract $() substitutions
    const { subs, cleaned } = extractDollarSubs(processedString);
    processedString = cleaned;
    
    // Process nested substitutions recursively
    for (const sub of subs) {
      // Recursively extract from this substitution (it might contain more $())
      const subResult = extractDollarSubs(sub);
      // Process any nested substitutions first
      for (const nestedSub of subResult.subs) {
        const parsed = parse(nestedSub);
        collectFromTokens(parsed, nestedCommands);
      }
      // Then process the cleaned version of this substitution
      const parsed = parse(subResult.cleaned);
      collectFromTokens(parsed, nestedCommands);
    }
    
    try {
      const parsed = parse(processedString);
      collectFromTokens(parsed, outerCommands);
    } catch (error) {
      // Fallback: if parsing fails, extract first word as command
      const firstWord = processedString.trim().split(/\s+/)[0];
      if (firstWord && !firstWord.startsWith('__SUB')) {
        outerCommands.push(firstWord);
      }
    }
    
    // Combine and deduplicate: nested commands first (they execute first), then outer
    const result: string[] = [];
    for (const cmd of [...nestedCommands, ...outerCommands]) {
      if (cmd && !seen.has(cmd)) {
        seen.add(cmd);
        result.push(cmd);
      }
    }
    
    return result;
  }
  
  /**
   * Check if a command string contains potentially dangerous patterns
   * @param commandString The command string to check
   * @returns true if dangerous patterns are detected
   */
  static hasDangerousPatterns(commandString: string): boolean {
    try {
      // Check for backticks (not handled by shell-quote parse)
      if (/`/.test(commandString)) {
        return true;
      }
      
      const parsed = parse(commandString);
      
      // Check if there are any operators (pipes, &&, ||, etc.)
      return parsed.some(token => 
        typeof token === 'object' && 
        token !== null && 
        'op' in token
      );
    } catch {
      // If parsing fails, consider it potentially dangerous
      return true;
    }
  }
}
