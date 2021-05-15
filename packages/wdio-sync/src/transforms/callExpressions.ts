import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'

import { makeParentAsync } from '../utils'
import { SELECTOR_COMMANDS } from '../constants'

export default function CallExpression (path: NodePath<t.CallExpression>) {
    /**
     * transform
     *  $(...)
     * into
     *  await $('...)
     */
    if (
        t.isIdentifier(path.node.callee) &&
        SELECTOR_COMMANDS.includes(path.node.callee.name) &&
        !t.isAwaitExpression(path.parentPath.node)
    ) {
        makeParentAsync(path)
        path.replaceWith(
            t.awaitExpression(path.node)
        )
    }
}
