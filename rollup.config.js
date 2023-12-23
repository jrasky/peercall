const typescript = require('@rollup/plugin-typescript');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');

module.exports = {
    default: {
        input: 'bin/server.ts',
        output: {
            dir: 'dist',
            format: 'cjs',
        },
        plugins: [
            typescript({ tsconfig: 'tsconfig.node.json' }),
            nodeResolve(),
            commonjs(),
            json(),
        ],
    },
};
