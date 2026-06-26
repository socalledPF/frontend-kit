export interface TreeOptions {
  idKey?: string
  parentKey?: string
  childrenKey?: string
  rootParentValues?: unknown[]
}

const defaultRootParentValues = [undefined, null, '', 0, '0']

function getValue(item: Record<string, unknown>, key: string): unknown {
  return item[key]
}

export function treeToList<T extends Record<string, unknown>>(
  tree: T[],
  options: Pick<TreeOptions, 'childrenKey'> = {}
): T[] {
  const { childrenKey = 'children' } = options
  const result: T[] = []

  const walk = (nodes: T[]) => {
    nodes.forEach((node) => {
      result.push(node)
      const children = getValue(node, childrenKey)

      if (Array.isArray(children)) {
        walk(children as T[])
      }
    })
  }

  walk(tree)
  return result
}

export function listToTree<T extends Record<string, unknown>>(
  list: T[],
  options: TreeOptions = {}
): T[] {
  const {
    idKey = 'id',
    parentKey = 'parentId',
    childrenKey = 'children',
    rootParentValues = defaultRootParentValues
  } = options

  const nodeMap = new Map<unknown, T & Record<string, unknown>>()
  const roots: Array<T & Record<string, unknown>> = []

  list.forEach((item) => {
    nodeMap.set(getValue(item, idKey), {
      ...item,
      [childrenKey]: []
    })
  })

  nodeMap.forEach((node) => {
    const parentId = getValue(node, parentKey)
    const parent = nodeMap.get(parentId)

    if (rootParentValues.includes(parentId) || !parent) {
      roots.push(node)
      return
    }

    const children = parent[childrenKey]
    if (Array.isArray(children)) {
      children.push(node)
    }
  })

  return roots as T[]
}

export function findTreeNode<T extends Record<string, unknown>>(
  tree: T[],
  predicate: (node: T) => boolean,
  options: Pick<TreeOptions, 'childrenKey'> = {}
): T | undefined {
  const { childrenKey = 'children' } = options

  for (const node of tree) {
    if (predicate(node)) {
      return node
    }

    const children = getValue(node, childrenKey)
    if (Array.isArray(children)) {
      const found = findTreeNode(children as T[], predicate, options)
      if (found) {
        return found
      }
    }
  }

  return undefined
}
