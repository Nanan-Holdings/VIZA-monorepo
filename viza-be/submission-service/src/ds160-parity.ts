import ts from "typescript";

export { ds160ConditionMatches } from "./ds160-conditions";

export interface Ds160SeedField {
  name: string;
  page: string;
  step: number;
  type: string;
  label: string;
  required: boolean;
  showIf?: string;
  repeatGroup?: string;
}

function unwrap(node: ts.Node): ts.Node {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) {
    return unwrap(node.expression);
  }
  return node;
}

function property(node: ts.Node, key: string): ts.Node | undefined {
  const value = unwrap(node);
  if (!ts.isObjectLiteralExpression(value)) return undefined;
  for (const entry of value.properties) {
    if (ts.isPropertyAssignment(entry) &&
      (ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name)) && entry.name.text === key) {
      return unwrap(entry.initializer);
    }
  }
  return undefined;
}

function literal(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  const value = unwrap(node);
  return ts.isStringLiteral(value) || ts.isNumericLiteral(value) ? value.text : undefined;
}

function booleanLiteral(node: ts.Node | undefined): boolean | undefined {
  if (!node) return undefined;
  const value = unwrap(node);
  if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

/** Read declarations without importing/executing the database seed script. */
export function readDs160SeedFields(source: string): Ds160SeedField[] {
  const file = ts.createSourceFile("seed-ds160-form-fields.ts", source, ts.ScriptTarget.Latest, true);
  let initializer: ts.Expression | undefined;
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === "FIELDS") {
        initializer = declaration.initializer;
      }
    }
  }
  if (!initializer) throw new Error("DS-160 FIELDS declaration not found");
  const fields: Ds160SeedField[] = [];
  const add = (field: Ds160SeedField) => {
    if (fields.some(existing => existing.name === field.name)) {
      throw new Error(`Duplicate DS-160 field declaration: ${field.name}`);
    }
    fields.push(field);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const name = literal(property(node, "field_name"));
      if (name) {
        const conditional = property(node, "conditional_logic");
        const rules = property(node, "validation_rules");
        add({
          name,
          page: literal(property(node, "step_name")) ?? "unknown",
          step: Number(literal(property(node, "step_number"))),
          type: literal(property(node, "field_type")) ?? "unknown",
          label: literal(property(node, "label")) ?? name,
          required: booleanLiteral(property(node, "required")) ?? false,
          showIf: conditional ? literal(property(conditional, "showIf")) : undefined,
          repeatGroup: rules ? literal(property(rules, "repeat_group")) : undefined,
        });
      }
      // Security parts generate question/explanation pairs from literal tuples.
      const tuples = property(node, "fields");
      const page = literal(property(node, "name"));
      const step = Number(literal(property(node, "step")));
      if (tuples && ts.isArrayLiteralExpression(tuples) && page && Number.isFinite(step)) {
        for (const tuple of tuples.elements) {
          const pair = unwrap(tuple);
          if (!ts.isArrayLiteralExpression(pair)) throw new Error("Unsupported DS-160 security tuple");
          const name = literal(pair.elements[0]);
          if (!name) throw new Error("Missing DS-160 security field name");
          add({
            name,
            page,
            step,
            type: "radio",
            label: literal(pair.elements[1]) ?? name,
            required: true,
          });
          add({
            name: `${name}_explain`,
            page,
            step,
            type: "textarea",
            label: "Explain",
            required: true,
            showIf: `${name} === yes`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(initializer);
  if (fields.length === 0) throw new Error("No DS-160 field declarations parsed");
  return fields;
}

export interface Ds160Derivations {
  dateSplits: ReadonlyArray<{ source: string; targetPrefix: string }>;
  naPairs: ReadonlyArray<{ source: string; naKey: string }>;
  keyAliases: ReadonlyArray<{ from: string; to: string }>;
  customDerivations: ReadonlyArray<{ requires: string[]; produces: string[] }>;
}

export function derivationEdges(rules: Ds160Derivations): Array<{ inputs: string[]; outputs: string[] }> {
  return [
    ...rules.keyAliases.map(rule => ({ inputs: [rule.from], outputs: [rule.to] })),
    ...rules.dateSplits.map(rule => ({ inputs: [rule.source], outputs: ["day", "month", "year"].map(part => `${rule.targetPrefix}_${part}`) })),
    ...rules.naPairs.map(rule => ({ inputs: [rule.source], outputs: [rule.naKey] })),
    ...rules.customDerivations.map(rule => ({ inputs: rule.requires, outputs: rule.produces })),
  ];
}

export function deriveKeyCoverage(source: Iterable<string>, rules: Ds160Derivations): Set<string> {
  const covered = new Set(source);
  const edges = derivationEdges(rules);
  let previousSize: number;
  do {
    previousSize = covered.size;
    for (const edge of edges) {
      if (edge.inputs.every(key => covered.has(key))) edge.outputs.forEach(key => covered.add(key));
    }
  } while (covered.size !== previousSize);
  return covered;
}

/** Trace consumers back to form inputs, including chained aliases/derived flags. */
export function consumedSourceKeys(targets: Iterable<string>, rules: Ds160Derivations): Set<string> {
  const consumed = new Set(targets);
  const edges = derivationEdges(rules);
  let previousSize: number;
  do {
    previousSize = consumed.size;
    for (const edge of edges) {
      if (edge.outputs.some(key => consumed.has(key))) edge.inputs.forEach(key => consumed.add(key));
    }
  } while (consumed.size !== previousSize);
  return consumed;
}

export function branchInventory(fields: Ds160SeedField[], consumed: Set<string>) {
  const expressions = [...new Set(fields.flatMap(field => field.showIf ? [field.showIf] : []))];
  return expressions.map(expression => {
    const branchFields = fields.filter(field => field.showIf === expression);
    return {
      expression,
      fields: branchFields.map(field => field.name),
      unmappedFields: branchFields.filter(field => !consumed.has(field.name)).map(field => field.name),
      officialVerified: false,
    };
  });
}
