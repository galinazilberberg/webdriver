import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'

import { makeParentAsync } from '../utils'
import { COMMAND_NAMES, SELECTOR_COMMANDS } from '../constants'

export default function MemberExpression (path: NodePath<t.MemberExpression>) {
    /**
     * transform any
     *  browser.XXX(...)
     * into
     *  await browser.XXX(...)
     */
    if (
        t.isIdentifier(path.node.object) &&
        path.node.object.name === 'browser' &&
        t.isIdentifier(path.node.property) &&
        COMMAND_NAMES.includes(path.node.property.name) &&
        t.isCallExpression(path.parentPath.node) &&
        !t.isAwaitExpression(path.parentPath.parentPath.node)
    ) {
        makeParentAsync(path)
        path.parentPath.replaceWith(
            t.awaitExpression(path.parentPath.node)
        )
    }

    /**
     * transform
     *  $(...).$(...)
     * into
     *  (await (await $(...)).$(...))
     */
    if (
        t.isIdentifier(path.node.property) &&
        SELECTOR_COMMANDS.includes(path.node.property.name) &&
        t.isCallExpression(path.parentPath.node) &&
        !t.isAwaitExpression(path.parentPath.parentPath.node)
    ) {
        makeParentAsync(path)
        path.parentPath.replaceWith(
            t.awaitExpression(path.parentPath.node)
        )
    }

    /**
     * transform
     *  (await $(...)).click()
     * into
     *  await (await $(...)).click()
     */
    if (
        t.isIdentifier(path.node.property) &&
        COMMAND_NAMES.includes(path.node.property.name) &&
        t.isCallExpression(path.parentPath.node) &&
        !t.isAwaitExpression(path.parentPath.parentPath.node)
    ) {
        makeParentAsync(path)
        path.parentPath.replaceWith(
            t.awaitExpression(path.parentPath.node)
        )
    }
}
