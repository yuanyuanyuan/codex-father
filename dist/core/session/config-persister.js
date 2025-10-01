import * as fs from 'fs/promises';
import * as path from 'path';
import { SessionSchema, SessionStatus, } from '../lib/types.js';
export class ConfigPersister {
    configFilePath;
    config;
    constructor(config) {
        this.config = {
            sessionDir: config.sessionDir,
            configFileName: config.configFileName || 'config.json',
            validateConfig: config.validateConfig ?? true,
            atomicWrite: config.atomicWrite ?? true,
        };
        this.configFilePath = path.join(this.config.sessionDir, this.config.configFileName);
    }
    async saveConfig(session) {
        if (this.config.validateConfig) {
            const result = SessionSchema.safeParse(session);
            if (!result.success) {
                throw new Error(`Invalid session config format: ${JSON.stringify(result.error.errors)}`);
            }
        }
        await this.ensureSessionDirExists();
        const configData = {
            conversationId: session.conversationId,
            sessionName: session.sessionName,
            jobId: session.jobId,
            createdAt: session.createdAt.toISOString(),
            rolloutRef: session.rolloutRef,
            config: session.config,
            ...(typeof session.processId === 'number' ? { processId: session.processId } : {}),
        };
        const jsonContent = JSON.stringify(configData, null, 2);
        if (this.config.atomicWrite) {
            await this.atomicWriteFile(this.configFilePath, jsonContent);
        }
        else {
            await fs.writeFile(this.configFilePath, jsonContent, 'utf-8');
        }
    }
    async loadConfig() {
        try {
            const content = await fs.readFile(this.configFilePath, 'utf-8');
            const parsed = JSON.parse(content);
            const session = {
                conversationId: parsed.conversationId,
                sessionName: parsed.sessionName,
                jobId: parsed.jobId,
                createdAt: new Date(parsed.createdAt),
                sessionDir: this.config.sessionDir,
                rolloutRef: parsed.rolloutRef,
                status: this.inferSessionStatus(parsed),
                config: parsed.config,
                ...(typeof parsed.processId === 'number' ? { processId: parsed.processId } : {}),
            };
            if (this.config.validateConfig) {
                const result = SessionSchema.safeParse(session);
                if (!result.success) {
                    throw new Error(`Invalid session config format: ${JSON.stringify(result.error.errors)}`);
                }
            }
            return session;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Config file not found: ${this.configFilePath}`);
            }
            throw error;
        }
    }
    async configExists() {
        try {
            await fs.access(this.configFilePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async deleteConfig() {
        try {
            await fs.unlink(this.configFilePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    async updateRolloutRef(rolloutPath) {
        const session = await this.loadConfig();
        session.rolloutRef = rolloutPath;
        await this.saveConfig(session);
    }
    getConfigFilePath() {
        return this.configFilePath;
    }
    async atomicWriteFile(filePath, content) {
        const tempFilePath = `${filePath}.tmp.${Date.now()}`;
        try {
            await fs.writeFile(tempFilePath, content, 'utf-8');
            await fs.rename(tempFilePath, filePath);
        }
        catch (error) {
            try {
                await fs.unlink(tempFilePath);
            }
            catch {
            }
            throw error;
        }
    }
    async ensureSessionDirExists() {
        try {
            await fs.mkdir(this.config.sessionDir, { recursive: true });
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    inferSessionStatus(_config) {
        return SessionStatus.TERMINATED;
    }
}
export function createConfigPersister(config) {
    return new ConfigPersister(config);
}
export async function saveRolloutRef(sessionDir, rolloutPath) {
    const rolloutRefPath = path.join(sessionDir, 'rollout-ref.txt');
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.writeFile(rolloutRefPath, rolloutPath, 'utf-8');
}
export async function loadRolloutRef(sessionDir) {
    const rolloutRefPath = path.join(sessionDir, 'rollout-ref.txt');
    try {
        const content = await fs.readFile(rolloutRefPath, 'utf-8');
        return content.trim();
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Rollout reference file not found: ${rolloutRefPath}`);
        }
        throw error;
    }
}
