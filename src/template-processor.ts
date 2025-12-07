/**
 * Template Variable Processor
 * 
 * Handles Mustache-style variable substitution in command templates.
 * Uses custom implementation instead of libraries like Mustache.js or Handlebars
 * for the following reasons:
 * 
 * 1. Perfect syntax match: Our {{var:default}} syntax is custom and clean
 * 2. Zero dependencies: No bloat, no security vulnerabilities from npm packages
 * 3. Lightweight: ~30 lines vs 3-70KB for templating libraries
 * 4. Simple and predictable: We control exact behavior, no surprises
 * 5. Fast: No library initialization or overhead
 * 
 * Standard libraries like Mustache.js don't support our {{var:default}} syntax
 * natively, and using helpers/workarounds would negate the benefits.
 * 
 * DOCKER/GO TEMPLATE COMPATIBILITY:
 * Patterns starting with a dot ({{.Field}}) are intentionally skipped to avoid
 * conflicts with Docker's built-in --format syntax and Go templates.
 * 
 * Examples:
 * - {{pod}} → substituted (our template variable)
 * - {{lines:100}} → substituted with default (our template variable)
 * - {{.Name}} → preserved (Docker/Go template)
 * - {{.CPUPerc}} → preserved (Docker/Go template)
 * 
 * See: TEMPLATE_PROCESSOR_RATIONALE.md for detailed analysis
 */

/**
 * Regular expression pattern to match template variables.
 * 
 * Pattern: \{\{([^}:.]+)(?::(.*?))?\}\}
 * 
 * Matches:
 * - {{variableName}} - Required variable
 * - {{variableName:defaultValue}} - Optional variable with default
 * 
 * Does NOT match (Docker/Go templates):
 * - {{.field}} - Patterns starting with a dot are skipped
 * 
 * Breakdown:
 * - \{\{ - Literal opening braces
 * - ([^}:.]+) - Capture group 1: Variable name (no }, :, or .)
 * - (?::(.*?))? - Optional non-capturing group for default value
 *   - : - Literal colon
 *   - (.*?) - Capture group 2: Default value (non-greedy)
 * - \}\} - Literal closing braces
 */
const TEMPLATE_VARIABLE_PATTERN = '\\{\\{([^}:.]+)(?::(.*?))?\\}\\}';

export interface TemplateVariable {
  name: string;
  required: boolean;
  defaultValue?: string;
}

/**
 * Substitutes variables in a template string.
 * 
 * Syntax:
 * - {{variableName}} - Required variable
 * - {{variableName:defaultValue}} - Optional variable with default
 * - {{.field}} - Skipped (preserved for Docker/Go templates)
 * 
 * @param template - Template string with {{var}} or {{var:default}} patterns
 * @param variables - Object mapping variable names to values
 * @returns Processed template with variables substituted
 * @throws Error if required variables are missing
 * 
 * @example
 * substituteVariables('Hello {{name}}', { name: 'World' })
 * // Returns: 'Hello World'
 * 
 * @example
 * substituteVariables('kubectl logs {{pod}} --tail={{lines:100}}', { pod: 'api-123' })
 * // Returns: 'kubectl logs api-123 --tail=100'
 * 
 * @example
 * substituteVariables('docker stats {{container}} --format "{{.Name}}"', { container: 'web' })
 * // Returns: 'docker stats web --format "{{.Name}}"'
 * // Note: {{.Name}} is preserved for Docker
 */
export function substituteVariables(
  template: string,
  variables?: Record<string, string>
): string {
  let result = template;
  const missingVars: string[] = [];

  result = result.replace(new RegExp(TEMPLATE_VARIABLE_PATTERN, 'g'), (match, varName, defaultValue) => {
    const value = variables?.[varName];
    if (value !== undefined && value !== null) {
      return String(value);
    } else if (defaultValue !== undefined) {
      return defaultValue;
    } else {
      missingVars.push(varName);
      return match;
    }
  });

  if (missingVars.length > 0) {
    throw new Error(`Missing required template variable${missingVars.length > 1 ? 's' : ''}: ${missingVars.join(', ')}`);
  }

  return result;
}

/**
 * Extracts variable metadata from a template string.
 * 
 * @param template - Template string to analyze
 * @returns Array of variable metadata (name, required, defaultValue)
 * 
 * @example
 * extractVariables('kubectl logs -n {{namespace}} {{pod}} --tail={{lines:100}}')
 * // Returns: [
 * //   { name: 'namespace', required: true },
 * //   { name: 'pod', required: true },
 * //   { name: 'lines', required: false, defaultValue: '100' }
 * // ]
 * 
 * @example
 * extractVariables('docker stats {{container}} --format "{{.Name}} {{.CPUPerc}}"')
 * // Returns: [
 * //   { name: 'container', required: true }
 * // ]
 * // Note: {{.Name}} and {{.CPUPerc}} are ignored (Docker templates)
 */
export function extractVariables(template: string): TemplateVariable[] {
  const variables: TemplateVariable[] = [];
  const seen = new Set<string>();

  const regex = new RegExp(TEMPLATE_VARIABLE_PATTERN, 'g');
  let match;
  
  while ((match = regex.exec(template)) !== null) {
    const varName = match[1];
    const defaultValue = match[2];

    if (!seen.has(varName)) {
      seen.add(varName);
      variables.push({
        name: varName,
        required: defaultValue === undefined,
        defaultValue: defaultValue,
      });
    }
  }

  return variables;
}

