import * as https from 'https';
import * as os from 'os';
import { spawn } from 'child_process';
import { Arguments } from 'yargs';

export const noop = () => {};

export const prettyGitURL = (repo: string | null) => {
    if (repo) {
        return repo
            .replace('git+', '')
            .replace('git@', 'https://')
            .replace('git://', 'https://')
            .replace('github.com:', 'github.com/')
            .replace('github:', 'github.com/')
            .replace('gitlab.com:', 'gitlab.com/')
            .replace('gitlab:', 'gitlab.com/')
            .replace('bitbucket.org:', 'bitbucket.org/')
            .replace('bitbucket:', 'bitbucket.org/')
            .replace('.git', '');
    }
    return repo;
};

export const safeURL = (value: string) => {
    try {
        return new URL(value);
    } catch {
        return {
            hash: null,
            host: null,
            hostname: null,
            href: null,
            origin: null,
            password: null,
            pathname: null,
            port: null,
            protocol: null,
            search: null,
            searchParams: null,
            username: null,
        };
    }
};

export const ping = async (_url: string) => {
    return new Promise<boolean | string>((resolve, reject) => {
        const pathParts = safeURL(_url);
        const options: https.RequestOptions = {
            hostname: pathParts.hostname,
            port: pathParts.port,
            path: pathParts.pathname,
            method: 'HEAD',
        };

        const req = https.request(options, (res) => {
            switch (res.statusCode) {
                case 200:
                    resolve(true);
                    break;
                case 301:
                case 307:
                case 308:
                    resolve(res.headers.location !== undefined ? res.headers.location : true);
                    break;
                default:
                    resolve(false);
            }
        });

        req.on('error', (e) => {
            resolve(false);
        });

        req.end();
    });
};

export const npmDepsToPaths = async (cwd: string, deep: boolean = false) => {
    const args = ['--prefix', cwd, 'ls', '--prod', '--json', '--depth', deep ? 'Infinity' : '0'];

    const deps = await npm(cwd, args).catch(e => null);
    if (deps !== null) {
        const result = safeParseJSON(deps);
        const packagePaths: string[] = [];
        if (result) {
            walkPath(result.dependencies, packagePaths);
            return packagePaths;
        } else {
            return null;
        }
    } else {
        return null;
    }
};

const safeParseJSON = (value: string) => {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const npm = (cwd: string, args: string[]) => {
    return new Promise<string>((resolve, reject) => {
        try {
            const npm = spawn(`npm${os.platform() === 'win32'?'.cmd':''}`, args, { cwd });
            const buffer: Buffer[] = [];
            npm.stdout.on('data', (data) => {
                buffer.push(data);
            });

            npm.on('close', () => {
                resolve(Buffer.concat(buffer).toString());
            });
        } catch (e) {
            throw e;
        }
    });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const walkPath = (data: any, results: any[]) => {
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const module = data[key];
            if (results.find((p) => p === key) === undefined) {
                results.push(key);
            }

            if (module.dependencies) {
                walkPath(module.dependencies, results);
            }
        }
    }
};
