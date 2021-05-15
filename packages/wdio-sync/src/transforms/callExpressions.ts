import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'

import { makeParentAsync } from '../utils'
import { SELECTOR_COMMANDS, ARRAY_METHODS } from '../constants'

let hasIteratorImport = false

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

    /**
     * transform
     *  (await $(...)).map(async (elem) => await elem.XXX())
     * into
     *  await (await $(...)).asyncMap(async (elem) => await elem.XXX())
     */
    if (
        t.isMemberExpression(path.node.callee) &&
        t.isIdentifier(path.node.callee.property) &&
        t.isCallExpression(path.node.callee.object) &&
        t.isIdentifier(path.node.callee.object.callee) &&
        SELECTOR_COMMANDS.includes(path.node.callee.object.callee.name) &&
        ARRAY_METHODS.includes(path.node.callee.property.name)
    ) {
        const arrayMethod = path.node.callee.property.name
        path.node.callee.property.name = `async${arrayMethod.slice(0, 1).toUpperCase()}${arrayMethod.slice(1)}`
        path.replaceWith(
            t.awaitExpression(
                path.node
            )
        )

        /**
         * add p-iterator import
         */
        if (!hasIteratorImport) {
            hasIteratorImport = true
            let program = path as any as NodePath<t.Program>
            while (!t.isProgram(program.node)) {
                program = program.parentPath as any
            }

            (program.node as t.Program).body.unshift(
                t.variableDeclaration('const', [
                    t.variableDeclarator(
                        t.objectPattern([
                            t.objectProperty(
                                t.identifier('instanceMethods'),
                                t.identifier('instanceMethods'),
                                false,
                                true
                            )
                        ]),
                        t.callExpression(
                            t.identifier('require'),
                            [t.stringLiteral('p-iterator')]
                        )
                    )
                ]),
                t.expressionStatement(
                    t.callExpression(
                        t.memberExpression(
                            t.identifier('Object'),
                            t.identifier('assign')
                        ),
                        [
                            t.memberExpression(
                                t.identifier('Array'),
                                t.identifier('prototype')
                            ),
                            t.identifier('instanceMethods')
                        ]
                    )
                )
            )
        }
    }
}
