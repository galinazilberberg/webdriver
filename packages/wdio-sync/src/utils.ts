import type { NodePath } from '@babel/traverse'

export function makeParentAsync (path: NodePath) {
    const fn = path.getFunctionParent()
    if (!fn?.node.async) {
        // @ts-expect-error
        fn?.node.async = true
    }
}
