import { ConditionConfig, SimpleCondition, CompoundCondition } from './types.ts';

export interface ConditionEvaluationResult {
  passed: boolean;
  decision: 'true' | 'false';
  reason: string;
  field?: string;
  actualValue?: any;
  targetValue?: any;
  operator?: string;
  subResults?: ConditionEvaluationResult[];
}

/**
 * Strict allowlisted condition evaluator.
 * Security Invariant: NEVER executes arbitrary JavaScript, eval(), or Function() calls.
 * Supports Compound Conditions (AND, OR, NOT) with short-circuit evaluation and max depth 5.
 */
export class ConditionEvaluator {
  public static readonly MAX_DEPTH = 5;

  evaluate(
    condition: ConditionConfig,
    context: Record<string, any>,
    depth = 1
  ): ConditionEvaluationResult {
    if (depth > ConditionEvaluator.MAX_DEPTH) {
      throw new Error(
        `Condition nesting depth limit exceeded (maximum allowed depth is ${ConditionEvaluator.MAX_DEPTH})`
      );
    }

    // Check if condition is a CompoundCondition
    if ('combinator' in condition && Array.isArray((condition as CompoundCondition).conditions)) {
      return this.evaluateCompound(condition as CompoundCondition, context, depth);
    }

    // Otherwise evaluate as SimpleCondition
    return this.evaluateSimple(condition as SimpleCondition, context);
  }

  private evaluateCompound(
    compound: CompoundCondition,
    context: Record<string, any>,
    depth: number
  ): ConditionEvaluationResult {
    const { combinator, conditions } = compound;

    if (!conditions || conditions.length === 0) {
      throw new Error(`Compound condition group with operator "${combinator}" must contain at least one sub-condition.`);
    }

    if (combinator === 'NOT') {
      const sub = this.evaluate(conditions[0], context, depth + 1);
      const passed = !sub.passed;
      return {
        passed,
        decision: passed ? 'true' : 'false',
        reason: `NOT(${sub.reason})`,
        operator: 'NOT',
        subResults: [sub],
      };
    }

    if (combinator === 'AND') {
      let passed = true;
      const subResults: ConditionEvaluationResult[] = [];
      for (const sub of conditions) {
        const res = this.evaluate(sub, context, depth + 1);
        subResults.push(res);
        if (!res.passed) {
          // Short-circuit: first false determines AND outcome
          passed = false;
          break;
        }
      }
      return {
        passed,
        decision: passed ? 'true' : 'false',
        reason: `AND(${subResults.map((r) => r.reason).join('; ')})`,
        operator: 'AND',
        subResults,
      };
    }

    if (combinator === 'OR') {
      let passed = false;
      const subResults: ConditionEvaluationResult[] = [];
      for (const sub of conditions) {
        const res = this.evaluate(sub, context, depth + 1);
        subResults.push(res);
        if (res.passed) {
          // Short-circuit: first true determines OR outcome
          passed = true;
          break;
        }
      }
      return {
        passed,
        decision: passed ? 'true' : 'false',
        reason: `OR(${subResults.map((r) => r.reason).join('; ')})`,
        operator: 'OR',
        subResults,
      };
    }

    throw new Error(`Unsupported logical combinator "${combinator}"`);
  }

  private evaluateSimple(
    condition: SimpleCondition,
    context: Record<string, any>
  ): ConditionEvaluationResult {
    const { field, operator, value: targetVal } = condition;
    const actualVal = context[field];

    let passed = false;
    let reason = '';

    switch (operator) {
      case 'equals': {
        if (typeof targetVal === 'number' && typeof actualVal === 'string') {
          passed = Number(actualVal) === targetVal;
        } else if (typeof targetVal === 'string' && typeof actualVal === 'number') {
          passed = String(actualVal) === targetVal;
        } else if (typeof targetVal === 'boolean' && typeof actualVal === 'string') {
          passed = (actualVal.toLowerCase() === 'true') === targetVal;
        } else {
          passed = actualVal === targetVal;
        }
        reason = `Field "${field}" (${JSON.stringify(actualVal)}) ${passed ? '==' : '!='} ${JSON.stringify(targetVal)}`;
        break;
      }

      case 'not_equals': {
        if (typeof targetVal === 'number' && typeof actualVal === 'string') {
          passed = Number(actualVal) !== targetVal;
        } else if (typeof targetVal === 'string' && typeof actualVal === 'number') {
          passed = String(actualVal) !== targetVal;
        } else if (typeof targetVal === 'boolean' && typeof actualVal === 'string') {
          passed = (actualVal.toLowerCase() === 'true') !== targetVal;
        } else {
          passed = actualVal !== targetVal;
        }
        reason = `Field "${field}" (${JSON.stringify(actualVal)}) ${passed ? '!=' : '=='} ${JSON.stringify(targetVal)}`;
        break;
      }

      case 'greater_than': {
        const nActual = Number(actualVal);
        const nTarget = Number(targetVal);
        passed = !isNaN(nActual) && !isNaN(nTarget) && nActual > nTarget;
        reason = `Field "${field}" (${nActual}) ${passed ? '>' : '<='} ${nTarget}`;
        break;
      }

      case 'greater_than_or_equal': {
        const nActual = Number(actualVal);
        const nTarget = Number(targetVal);
        passed = !isNaN(nActual) && !isNaN(nTarget) && nActual >= nTarget;
        reason = `Field "${field}" (${nActual}) ${passed ? '>=' : '<'} ${nTarget}`;
        break;
      }

      case 'less_than': {
        const nActual = Number(actualVal);
        const nTarget = Number(targetVal);
        passed = !isNaN(nActual) && !isNaN(nTarget) && nActual < nTarget;
        reason = `Field "${field}" (${nActual}) ${passed ? '<' : '>='} ${nTarget}`;
        break;
      }

      case 'less_than_or_equal': {
        const nActual = Number(actualVal);
        const nTarget = Number(targetVal);
        passed = !isNaN(nActual) && !isNaN(nTarget) && nActual <= nTarget;
        reason = `Field "${field}" (${nActual}) ${passed ? '<=' : '>'} ${nTarget}`;
        break;
      }

      case 'contains': {
        if (Array.isArray(actualVal)) {
          passed = actualVal.includes(targetVal);
        } else if (typeof actualVal === 'string') {
          passed = actualVal.toLowerCase().includes(String(targetVal).toLowerCase());
        } else {
          passed = false;
        }
        reason = `Field "${field}" ${passed ? 'contains' : 'does not contain'} ${JSON.stringify(targetVal)}`;
        break;
      }

      case 'exists': {
        passed = actualVal !== undefined && actualVal !== null && actualVal !== '';
        reason = `Field "${field}" ${passed ? 'exists' : 'does not exist'}`;
        break;
      }

      case 'is_empty': {
        passed =
          actualVal === undefined ||
          actualVal === null ||
          actualVal === '' ||
          (Array.isArray(actualVal) && actualVal.length === 0) ||
          (typeof actualVal === 'object' && Object.keys(actualVal).length === 0);
        reason = `Field "${field}" ${passed ? 'is empty' : 'is not empty'}`;
        break;
      }

      default: {
        passed = false;
        reason = `Unsupported conditional operator "${operator}"`;
      }
    }

    return {
      passed,
      decision: passed ? 'true' : 'false',
      reason,
      field,
      actualValue: actualVal,
      targetValue: targetVal,
      operator,
    };
  }
}

export const conditionEvaluator = new ConditionEvaluator();
