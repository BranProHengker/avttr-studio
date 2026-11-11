export interface JsonStats {
  totalKeys: number
  depth: number
  arrayCount: number
  objectCount: number
  primitiveCount: number
  byteSize: number
}

export interface TypeGenOptions {
  rootName?: string
  tsMode?: 'interface' | 'type'
  isOptional?: boolean
  isReadonly?: boolean
  useSemicolons?: boolean
}

export interface GraphNode {
  id: string
  label: string
  path: string
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  depth: number
  itemCount?: number
  properties: Array<{
    key: string
    type: string
    valuePreview: string
    isComplex: boolean
    targetId?: string
  }>
  x?: number
  y?: number
}

export interface GraphEdge {
  id: string
  fromId: string
  toId: string
  fromX?: number
  fromY?: number
  toX?: number
  toY?: number
}

function toPascal(str: string): string {
  if (!str) return 'Root'
  return str.replace(/(^|[-_ \t])(\w)/g, (_, __, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '') || 'Item'
}

function toSnake(str: string): string {
  if (!str) return 'field'
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_')
}

function sanitizeKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

export function autoFixJson(raw: string): string {
  let s = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  // Replace single quotes around strings
  s = s.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
  // Add quotes to unquoted object keys
  s = s.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1')
  return s
}

export function validateJson(raw: string): { valid: boolean; data?: any; error?: string; line?: number; col?: number } {
  if (!raw || !raw.trim()) {
    return { valid: false, error: 'Input is empty' }
  }
  try {
    const data = JSON.parse(raw)
    return { valid: true, data }
  } catch (err: any) {
    const msg = err.message || 'Invalid JSON syntax'
    // Try to extract line and column from error message
    const lineMatch = msg.match(/line (\d+) column (\d+)/i) || msg.match(/position (\d+)/i)
    let line: number | undefined
    let col: number | undefined
    if (lineMatch && lineMatch[2]) {
      line = parseInt(lineMatch[1], 10)
      col = parseInt(lineMatch[2], 10)
    } else if (lineMatch && lineMatch[1]) {
      const pos = parseInt(lineMatch[1], 10)
      const lines = raw.slice(0, pos).split('\n')
      line = lines.length
      col = lines[lines.length - 1].length + 1
    }
    return { valid: false, error: msg, line, col }
  }
}

export function calculateJsonStats(data: any): JsonStats {
  let totalKeys = 0
  let maxDepth = 0
  let arrayCount = 0
  let objectCount = 0
  let primitiveCount = 0

  function traverse(val: any, currentDepth = 1) {
    if (currentDepth > maxDepth) maxDepth = currentDepth

    if (val === null || typeof val !== 'object') {
      primitiveCount++
      return
    }

    if (Array.isArray(val)) {
      arrayCount++
      for (const item of val) {
        traverse(item, currentDepth + 1)
      }
      return
    }

    objectCount++
    const keys = Object.keys(val)
    totalKeys += keys.length
    for (const k of keys) {
      traverse(val[k], currentDepth + 1)
    }
  }

  traverse(data, 1)
  const byteSize = new Blob([JSON.stringify(data)]).size

  return {
    totalKeys,
    depth: maxDepth,
    arrayCount,
    objectCount,
    primitiveCount,
    byteSize,
  }
}

// ─── 1. TypeScript Generator ───────────────────────────────────────────
export function jsonToTypeScript(data: any, options: TypeGenOptions = {}): string {
  const rootName = toPascal(options.rootName || 'Root')
  const isType = options.tsMode === 'type'
  const isOpt = options.isOptional ? '?' : ''
  const isRo = options.isReadonly ? 'readonly ' : ''
  const semi = options.useSemicolons !== false ? ';' : ''

  const definitions: string[] = []
  const generatedNames = new Set<string>()

  function parseObject(obj: Record<string, any>, name: string): string {
    let typeName = toPascal(name)
    if (generatedNames.has(typeName)) {
      typeName = `${typeName}_${generatedNames.size}`
    }
    generatedNames.add(typeName)

    const lines: string[] = []
    for (const [key, val] of Object.entries(obj)) {
      const fieldKey = sanitizeKey(key)
      const propType = resolveType(val, key)
      lines.push(`  ${isRo}${fieldKey}${isOpt}: ${propType}${semi}`)
    }

    if (isType) {
      definitions.push(`export type ${typeName} = {\n${lines.join('\n')}\n}${semi}`)
    } else {
      definitions.push(`export interface ${typeName} {\n${lines.join('\n')}\n}`)
    }
    return typeName
  }

  function resolveType(val: any, keyHint: string): string {
    if (val === null || val === undefined) return 'any'
    if (Array.isArray(val)) {
      if (val.length === 0) return 'any[]'
      const itemType = resolveType(val[0], keyHint ? `${keyHint}Item` : 'Item')
      return `${itemType}[]`
    }
    if (typeof val === 'object') {
      return parseObject(val, keyHint || 'Nested')
    }
    return typeof val
  }

  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      const itemType = parseObject(data[0], rootName ? `${rootName}Item` : 'Item')
      return `${definitions.reverse().join('\n\n')}\n\nexport type ${rootName} = ${itemType}[]${semi}`
    }
    return `export type ${rootName} = any[]${semi}`
  }

  if (typeof data === 'object' && data !== null) {
    parseObject(data, rootName)
    return definitions.reverse().join('\n\n')
  }

  return `export type ${rootName} = ${typeof data}${semi}`
}

// ─── 2. Zod Schema Generator ───────────────────────────────────────────
export function jsonToZod(data: any, options: TypeGenOptions = {}): string {
  const rootName = toPascal(options.rootName || 'Root')
  const schemas: string[] = []
  const generatedNames = new Set<string>()

  function parseObject(obj: Record<string, any>, name: string): string {
    let schemaName = `${toPascal(name)}Schema`
    if (generatedNames.has(schemaName)) {
      schemaName = `${toPascal(name)}_${generatedNames.size}Schema`
    }
    generatedNames.add(schemaName)

    const lines: string[] = []
    for (const [key, val] of Object.entries(obj)) {
      const fieldKey = sanitizeKey(key)
      let propZod = resolveZod(val, key)
      if (options.isOptional) propZod += '.optional()'
      lines.push(`  ${fieldKey}: ${propZod},`)
    }

    schemas.push(`export const ${schemaName} = z.object({\n${lines.join('\n')}\n});`)
    return schemaName
  }

  function resolveZod(val: any, keyHint: string): string {
    if (val === null || val === undefined) return 'z.any()'
    if (Array.isArray(val)) {
      if (val.length === 0) return 'z.array(z.any())'
      const itemSchema = resolveZod(val[0], keyHint ? `${keyHint}Item` : 'Item')
      return `z.array(${itemSchema})`
    }
    if (typeof val === 'object') {
      return parseObject(val, keyHint || 'Nested')
    }
    if (typeof val === 'string') return 'z.string()'
    if (typeof val === 'number') return 'z.number()'
    if (typeof val === 'boolean') return 'z.boolean()'
    return 'z.any()'
  }

  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
      const itemSchema = parseObject(data[0], rootName ? `${rootName}Item` : 'Item')
      schemas.push(`export const ${rootName}Schema = z.array(${itemSchema});`)
    } else {
      schemas.push(`export const ${rootName}Schema = z.array(z.any());`)
    }
  } else if (typeof data === 'object' && data !== null) {
    parseObject(data, rootName)
  }

  const rootTypeExport = `export type ${rootName} = z.infer<typeof ${rootName}Schema>;`
  return `import { z } from "zod";\n\n${schemas.reverse().join('\n\n')}\n\n${rootTypeExport}`
}

// ─── 3. Go Struct Generator ───────────────────────────────────────────
export function jsonToGo(data: any, options: TypeGenOptions = {}): string {
  const rootName = toPascal(options.rootName || 'Root')
  const structs: string[] = []
  const generatedNames = new Set<string>()

  function parseObject(obj: Record<string, any>, name: string): string {
    let typeName = toPascal(name)
    if (generatedNames.has(typeName)) {
      typeName = `${typeName}_${generatedNames.size}`
    }
    generatedNames.add(typeName)

    const lines: string[] = []
    for (const [key, val] of Object.entries(obj)) {
      const fieldName = toPascal(key)
      let fieldType = resolveGoType(val, key)
      if (options.isOptional) fieldType = `*${fieldType}`
      lines.push(`\t${fieldName} ${fieldType} \`json:"${key}"\``)
    }

    structs.push(`type ${typeName} struct {\n${lines.join('\n')}\n}`)
    return typeName
  }

  function resolveGoType(val: any, keyHint: string): string {
    if (val === null || val === undefined) return 'interface{}'
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]interface{}'
      const itemType = resolveGoType(val[0], keyHint ? `${keyHint}Item` : 'Item')
      return `[]${itemType}`
    }
    if (typeof val === 'object') {
      return parseObject(val, keyHint || 'Nested')
    }
    if (typeof val === 'string') return 'string'
    if (typeof val === 'number') return Number.isInteger(val) ? 'int64' : 'float64'
    if (typeof val === 'boolean') return 'bool'
    return 'interface{}'
  }

  if (typeof data === 'object' && data !== null) {
    parseObject(data, rootName)
  }

  return structs.reverse().join('\n\n')
}

// ─── 4. Rust Struct Generator ─────────────────────────────────────────
export function jsonToRust(data: any, options: TypeGenOptions = {}): string {
  const rootName = toPascal(options.rootName || 'Root')
  const structs: string[] = []
  const generatedNames = new Set<string>()

  function parseObject(obj: Record<string, any>, name: string): string {
    let typeName = toPascal(name)
    if (generatedNames.has(typeName)) {
      typeName = `${typeName}_${generatedNames.size}`
    }
    generatedNames.add(typeName)

    const lines: string[] = []
    for (const [key, val] of Object.entries(obj)) {
      const fieldName = toSnake(key)
      let fieldType = resolveRustType(val, key)
      if (options.isOptional && !fieldType.startsWith('Option<')) {
        fieldType = `Option<${fieldType}>`
      }
      lines.push(`    #[serde(rename = "${key}")]\n    pub ${fieldName}: ${fieldType},`)
    }

    structs.push(`#[derive(Default, Debug, Clone, PartialEq, Serialize, Deserialize)]\n#[serde(rename_all = "camelCase")]\npub struct ${typeName} {\n${lines.join('\n')}\n}`)
    return typeName
  }

  function resolveRustType(val: any, keyHint: string): string {
    if (val === null || val === undefined) return 'Option<Value>'
    if (Array.isArray(val)) {
      if (val.length === 0) return 'Vec<Value>'
      const itemType = resolveRustType(val[0], keyHint ? `${keyHint}Item` : 'Item')
      return `Vec<${itemType}>`
    }
    if (typeof val === 'object') {
      return parseObject(val, keyHint || 'Nested')
    }
    if (typeof val === 'string') return 'String'
    if (typeof val === 'number') return Number.isInteger(val) ? 'i64' : 'f64'
    if (typeof val === 'boolean') return 'bool'
    return 'Value'
  }

  if (typeof data === 'object' && data !== null) {
    parseObject(data, rootName)
  }

  return `use serde::{Deserialize, Serialize};\nuse serde_json::Value;\n\n${structs.reverse().join('\n\n')}`
}

// ─── 5. Python (Pydantic) Generator ───────────────────────────────────
export function jsonToPython(data: any, options: TypeGenOptions = {}): string {
  const rootName = toPascal(options.rootName || 'Root')
  const classes: string[] = []
  const generatedNames = new Set<string>()

  function parseObject(obj: Record<string, any>, name: string): string {
    let className = toPascal(name)
    if (generatedNames.has(className)) {
      className = `${className}_${generatedNames.size}`
    }
    generatedNames.add(className)

    const lines: string[] = []
    for (const [key, val] of Object.entries(obj)) {
      const fieldName = toSnake(key)
      let fieldType = resolvePyType(val, key)
      if (options.isOptional && !fieldType.startsWith('Optional[')) {
        fieldType = `Optional[${fieldType}] = None`
      }
      lines.push(`    ${fieldName}: ${fieldType}`)
    }

    classes.push(`class ${className}(BaseModel):\n${lines.join('\n')}`)
    return className
  }

  function resolvePyType(val: any, keyHint: string): string {
    if (val === null || val === undefined) return 'Optional[Any] = None'
    if (Array.isArray(val)) {
      if (val.length === 0) return 'list[Any]'
      const itemType = resolvePyType(val[0], keyHint ? `${keyHint}Item` : 'Item')
      return `list[${itemType}]`
    }
    if (typeof val === 'object') {
      return parseObject(val, keyHint || 'Nested')
    }
    if (typeof val === 'string') return 'str'
    if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float'
    if (typeof val === 'boolean') return 'bool'
    return 'Any'
  }

  if (typeof data === 'object' && data !== null) {
    parseObject(data, rootName)
  }

  return `from typing import Optional, Any\nfrom pydantic import BaseModel\n\n\n${classes.reverse().join('\n\n\n')}`
}

// ─── 6. JSON Schema (Draft-07) Generator ──────────────────────────────
export function jsonToJsonSchema(data: any, options: TypeGenOptions = {}): string {
  const rootName = toPascal(options.rootName || 'Root')

  function parseSchema(val: any): Record<string, any> {
    if (val === null) return { type: 'null' }
    if (Array.isArray(val)) {
      if (val.length === 0) return { type: 'array' }
      return { type: 'array', items: parseSchema(val[0]) }
    }
    if (typeof val === 'object') {
      const properties: Record<string, any> = {}
      const required: string[] = []
      for (const [k, v] of Object.entries(val)) {
        properties[k] = parseSchema(v)
        if (!options.isOptional) required.push(k)
      }
      const schemaObj: Record<string, any> = { type: 'object', properties }
      if (required.length > 0) schemaObj.required = required
      return schemaObj
    }
    if (typeof val === 'string') return { type: 'string' }
    if (typeof val === 'number') return Number.isInteger(val) ? { type: 'integer' } : { type: 'number' }
    if (typeof val === 'boolean') return { type: 'boolean' }
    return {}
  }

  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: rootName,
    ...parseSchema(data),
  }
  return JSON.stringify(schema, null, 2)
}

// ─── 7. Graph Hierarchy & Tree Node Builder ───────────────────────────
export function buildGraphNodes(data: any, rootName = 'Root'): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  let nodeCount = 0

  function traverse(val: any, label: string, path: string, depth = 0, parentId?: string): string {
    const nodeId = `node_${++nodeCount}`
    const isArr = Array.isArray(val)
    const isObj = typeof val === 'object' && val !== null && !isArr
    const nodeType = isArr ? 'array' : isObj ? 'object' : val === null ? 'null' : (typeof val as any)

    const props: GraphNode['properties'] = []

    if (isObj) {
      for (const [k, v] of Object.entries(val)) {
        const isChildComplex = typeof v === 'object' && v !== null
        const childPath = `${path}.${k}`
        let targetId: string | undefined

        if (isChildComplex) {
          targetId = traverse(v, k, childPath, depth + 1, nodeId)
        }

        const valuePreview = isChildComplex
          ? Array.isArray(v) ? `Array[${v.length}]` : `Object{${Object.keys(v).length}}`
          : v === null ? 'null' : String(v).slice(0, 24)

        props.push({
          key: k,
          type: Array.isArray(v) ? 'array' : typeof v,
          valuePreview,
          isComplex: isChildComplex,
          targetId,
        })
      }
    } else if (isArr) {
      val.slice(0, 10).forEach((item: any, idx: number) => {
        const isChildComplex = typeof item === 'object' && item !== null
        const childPath = `${path}[${idx}]`
        let targetId: string | undefined

        if (isChildComplex) {
          targetId = traverse(item, `[${idx}]`, childPath, depth + 1, nodeId)
        }

        const valuePreview = isChildComplex
          ? Array.isArray(item) ? `Array[${item.length}]` : `Object{${Object.keys(item).length}}`
          : item === null ? 'null' : String(item).slice(0, 24)

        props.push({
          key: `[${idx}]`,
          type: Array.isArray(item) ? 'array' : typeof item,
          valuePreview,
          isComplex: isChildComplex,
          targetId,
        })
      })
      if (val.length > 10) {
        props.push({
          key: `+ ${val.length - 10} more`,
          type: 'more',
          valuePreview: '...',
          isComplex: false,
        })
      }
    }

    const node: GraphNode = {
      id: nodeId,
      label,
      path,
      type: nodeType,
      depth,
      itemCount: isArr ? val.length : isObj ? Object.keys(val).length : undefined,
      properties: props,
    }
    nodes.push(node)

    if (parentId) {
      edges.push({
        id: `edge_${parentId}_${nodeId}`,
        fromId: parentId,
        toId: nodeId,
      })
    }

    return nodeId
  }

  traverse(data, rootName, '$', 0)

  // Layout node coordinates (Layered tree layout)
  const depthColumns: Record<number, GraphNode[]> = {}
  for (const n of nodes) {
    if (!depthColumns[n.depth]) depthColumns[n.depth] = []
    depthColumns[n.depth].push(n)
  }

  const columnWidth = 320
  const rowHeight = 220

  for (const [depthStr, list] of Object.entries(depthColumns)) {
    const d = parseInt(depthStr, 10)
    list.forEach((node, idx) => {
      node.x = 60 + d * columnWidth
      node.y = 60 + idx * rowHeight
    })
  }

  // Calculate coordinates on edges
  for (const e of edges) {
    const fromNode = nodes.find((n) => n.id === e.fromId)
    const toNode = nodes.find((n) => n.id === e.toId)
    if (fromNode && toNode) {
      e.fromX = (fromNode.x || 0) + 240
      e.fromY = (fromNode.y || 0) + 40
      e.toX = toNode.x || 0
      e.toY = (toNode.y || 0) + 40
    }
  }

  return { nodes, edges }
}
