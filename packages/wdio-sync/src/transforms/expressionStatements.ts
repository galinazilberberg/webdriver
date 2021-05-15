import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'

import { makeParentAsync } from '../utils'
import type { TransformOpts } from '../types'

export default function ExpressionStatement (path: NodePath<t.ExpressionStatement>, state: TransformOpts) {
    /**
     * transform
     *  expect(...)
     * into
     *  await expect(...)
     */
    if (
        t.isCallExpression(path.node.expression) &&
        t.isMemberExpression(path.node.expression.callee) &&
        t.isCallExpression(path.node.expression.callee.object) &&
        t.isIdentifier(path.node.expression.callee.object.callee) &&
        path.node.expression.callee.object.callee.name === 'expect'
    ) {
        makeParentAsync(path)

        if (state.opts.wdioConfig.framework !== 'jasmine') {
            path.node.expression.callee.object.callee.name = 'expectAsync'
        }

        path.replaceWith(
            t.expressionStatement(
                t.awaitExpression(path.node.expression)
            )
        )
    }
}
