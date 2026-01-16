import * as fs from "fs/promises"
import * as path from "path"
import matter from "gray-matter"

export interface SkillMetadata {
    name: string
    description: string
    path: string
}

export interface SkillContent extends SkillMetadata {
    instructions: string
}

export class SkillsManager {
    private skills: Map<string, SkillMetadata> = new Map()
    // 项目根目录，其中包含 .schooberAi/skills
    private workspaceRoot: string

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot
    }

    /**
     * 初始化管理器并加载现有的技能。
     */
    async initialize(): Promise<void> {
        await this.discoverSkills()
    }

    /**
     * 从 .schoober/skills 目录发现技能。
     */
    async discoverSkills(): Promise<void> {
        this.skills.clear()
        const skillsDir = path.join(this.workspaceRoot, ".schoober", "skills")

        try {
            // 检查目录是否存在
            await fs.access(skillsDir)
        } catch {
            // 目录不存在，直接返回空
            return
        }

        try {
            const entries = await fs.readdir(skillsDir, { withFileTypes: true })

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await this.loadSkillMetadata(path.join(skillsDir, entry.name))
                }
            }
        } catch (error) {
            console.error("Failed to discover skills:", error)
        }
    }

    /**
     * 从特定的技能目录加载技能元数据。
     */
    private async loadSkillMetadata(skillDir: string): Promise<void> {
        const skillMdPath = path.join(skillDir, "SKILL.md")

        try {
            // 检查 SKILL.md 是否存在
            await fs.access(skillMdPath)

            const fileContent = await fs.readFile(skillMdPath, "utf-8")
            // 解析 frontmatter
            const { data: frontmatter } = matter(fileContent)

            // 基本验证
            if (!frontmatter.name || typeof frontmatter.name !== "string") {
                console.warn(`Skill at ${skillDir} is missing required 'name' field`)
                return
            }
            if (!frontmatter.description || typeof frontmatter.description !== "string") {
                console.warn(`Skill at ${skillDir} is missing required 'description' field`)
                return
            }

            // 存储元数据
            this.skills.set(frontmatter.name, {
                name: frontmatter.name,
                description: frontmatter.description,
                path: skillMdPath,
            })
        } catch (error) {
            // SKILL.md 缺失或不可读
        }
    }

    /**
     * 获取所有已加载的技能。
     */
    getAllSkills(): SkillMetadata[] {
        return Array.from(this.skills.values())
    }

    /**
     * 获取特定技能的完整内容（说明）。
     */
    async getSkillContent(name: string): Promise<SkillContent | null> {
        const skill = this.skills.get(name)
        if (!skill) return null

        try {
            const fileContent = await fs.readFile(skill.path, "utf-8")
            const { content } = matter(fileContent)

            return {
                ...skill,
                instructions: content.trim(), // markdown 文件的正文
            }
        } catch (error) {
            console.error(`Failed to read skill content for ${name}:`, error)
            return null
        }
    }
}
