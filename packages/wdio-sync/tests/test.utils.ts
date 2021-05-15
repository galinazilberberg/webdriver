import path from 'path'
import babelFn from '@babel/cli/lib/babel/file'

export function runBabel (filename: string) {
    return babelFn({
        babelOptions: {
            plugins: [path.join(__dirname, '..')]
        },
        cliOptions: {
            filenames: [path.join(__dirname, '__fixtures__', `${filename}.js`)]
        }
    })
}

export async function assertCodeFromFixture (filename: string) {
    const origFn = process.stdout.write
    process.stdout.write = jest.fn()
    try {
        await runBabel(filename)
    } catch (err) {
        const stdoutCalls = (process.stdout.write as jest.Mock).mock.calls
        process.stdout.write = origFn
        stdoutCalls.forEach((out) => console.log(out))
        throw err
    }

    expect((process.stdout.write as jest.Mock).mock.calls[0][0])
        .toMatchSnapshot()
    process.stdout.write = origFn
}
