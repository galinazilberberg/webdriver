import logger from '@wdio/logger'
import iterators from 'p-iteration'

const log = logger('@wdio/utils:shim')

let inCommandHook = false
let hasWdioSyncSupport = false
let runSync: (this: unknown, fn: Function, repeatTest: any, args: unknown[]) => (resolve: Function, reject: Function) => unknown

interface Retries {
    limit: number
    attempts: number
}

const ELEMENT_QUERY_COMMANDS = ['$', '$$', 'custom$', 'custom$$', 'shadow$', 'shadow$$', 'react$', 'react$$']

let executeHooksWithArgs = async function executeHooksWithArgsShim<T> (hookName: string, hooks: Function | Function[] = [], args: any[] = []): Promise<(T | Error)[]> {
    /**
     * make sure hooks are an array of functions
     */
    if (!Array.isArray(hooks)) {
        hooks = [hooks]
    }

    /**
     * make sure args is an array since we are calling apply
     */
    if (!Array.isArray(args)) {
        args = [args]
    }

    const hooksPromises = hooks.map((hook) => new Promise<T | Error>((resolve) => {
        let result

        try {
            result = hook.apply(null, args)
        } catch (e) {
            log.error(e.stack)
            return resolve(e)
        }

        /**
         * if a promise is returned make sure we don't have a catch handler
         * so in case of a rejection it won't cause the hook to fail
         */
        if (result && typeof result.then === 'function') {
            return result.then(resolve, (e: Error) => {
                log.error(e.stack)
                resolve(e)
            })
        }

        resolve(result)
    }))

    const start = Date.now()
    const result = await Promise.all(hooksPromises)
    if (hooksPromises.length) {
        log.debug(`Finished to run "${hookName}" hook in ${Date.now() - start}ms`)
    }
    return result
}

let runFnInFiberContext = function (fn: Function) {
    return function (this: any, ...args: any[]) {
        return Promise.resolve(fn.apply(this, args))
    }
}

interface PropertiesObject {
    [key: string]: PropertyDescriptor
}

/**
 * wrap command to enable before and after command to be executed
 * @param commandName name of the command (e.g. getTitle)
 * @param fn          command function
 */
let wrapCommand = function wrapCommand<T>(commandName: string, fn: Function, propertiesObject: PropertiesObject): (...args: any) => Promise<T> {
    async function wrapCommandFn(this: any, ...args: any[]) {
        const beforeHookArgs = [commandName, args]
        if (!inCommandHook && this.options.beforeCommand) {
            inCommandHook = true
            await executeHooksWithArgs.call(this, 'beforeCommand', this.options.beforeCommand, beforeHookArgs)
            inCommandHook = false
        }

        let commandResult
        let commandError
        try {
            commandResult = await fn.apply(this, args)
        } catch (err) {
            commandError = err
        }

        if (!inCommandHook && this.options.afterCommand) {
            inCommandHook = true
            const afterHookArgs = [...beforeHookArgs, commandResult, commandError]
            await executeHooksWithArgs.call(this, 'afterCommand', this.options.afterCommand, afterHookArgs)
            inCommandHook = false
        }

        if (commandError) {
            throw commandError
        }

        return commandResult
    }

    function wrapElementFn (promise: Promise<any>, cmd: Function, args: any[]): any {
        return new Proxy(
            Promise.resolve(promise).then((ctx: any) => cmd.call(ctx, ...args)),
            {
                get: (target, prop: string) => {
                    if (ELEMENT_QUERY_COMMANDS.includes(prop)) {
                        return wrapCommand(prop, propertiesObject[prop].value, propertiesObject)
                    }

                    if (commandName.endsWith('$$') && prop === 'get') {
                        return (index: number) => wrapElementFn(
                            target,
                            function (this: any, index: number) {
                                return this[index]
                            },
                            [index]
                        )
                    }

                    if (commandName.endsWith('$$') && typeof iterators[prop as keyof typeof iterators] === 'function') {
                        return (mapIterator: Function) => wrapElementFn(
                            target,
                            function (this: any, mapIterator: Function) {
                                // @ts-expect-error
                                return iterators[prop as keyof typeof iterators](this, mapIterator)
                            },
                            [mapIterator]
                        )
                    }

                    if (prop === 'length') {
                        return target.then((res) => res.length)
                    }

                    if (prop === 'then') {
                        return target[prop].bind(target)
                    }

                    throw new Error(`Can't access property "${prop}" from element query`)
                }
            }
        )
    }

    if (ELEMENT_QUERY_COMMANDS.includes(commandName)) {
        return function wrapSyncCommand(this: any, ...args: any[]): any {
            return wrapElementFn(this, wrapCommandFn, args)
        }
    }

    return wrapCommandFn
}

/**
 * execute test or hook synchronously
 *
 * @param  {Function} fn         spec or hook method
 * @param  {Number}   retries    { limit: number, attempts: number }
 * @param  {Array}    args       arguments passed to hook
 * @return {Promise}             that gets resolved once test/hook is done or was retried enough
 */
async function executeSync (this: any, fn: Function, retries: Retries, args: any[] = []): Promise<unknown> {
    this.wdioRetries = retries.attempts

    try {
        let res = fn.apply(this, args)

        /**
         * sometimes function result is Promise,
         * we need to await result before proceeding
         */
        if (res instanceof Promise) {
            return await res
        }

        return res
    } catch (e) {
        if (retries.limit > retries.attempts) {
            retries.attempts++
            return await executeSync.call(this, fn, retries, args)
        }

        return Promise.reject(e)
    }
}

/**
 * execute test or hook asynchronously
 *
 * @param  {Function} fn         spec or hook method
 * @param  {object}   retries    { limit: number, attempts: number }
 * @param  {Array}    args       arguments passed to hook
 * @return {Promise}             that gets resolved once test/hook is done or was retried enough
 */
async function executeAsync(this: any, fn: Function, retries: Retries, args: any[] = []): Promise<unknown> {
    this.wdioRetries = retries.attempts

    try {
        return await fn.apply(this, args)
    } catch (e) {
        if (retries.limit > retries.attempts) {
            retries.attempts++
            return await executeAsync.call(this, fn, retries, args)
        }

        throw e
    }
}

export {
    executeHooksWithArgs,
    runFnInFiberContext,
    wrapCommand,
    hasWdioSyncSupport,
    executeSync,
    executeAsync,
    runSync
}
