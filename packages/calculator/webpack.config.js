const fs = require('fs');
const path = require('path');

// Helper to find the workspace root by looking for tsconfig.json
function findWorkspaceRoot(currentDir) {
    let dir = currentDir;
    while (dir !== path.parse(dir).root) {
        if (fs.existsSync(path.join(dir, 'tsconfig.json'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    throw new Error('Could not find workspace root (tsconfig.json not found).');
}

const workspaceRoot = findWorkspaceRoot(__dirname);

module.exports = {
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    mode: 'production',
    resolve: {
        extensions: ['.js'],
        alias: {
            'typescript_bazel_minimal': workspaceRoot,
        },
    },
};
