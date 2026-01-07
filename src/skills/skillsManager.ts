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
    // The root directory of the project where .schooberAi/skills is located
    private workspaceRoot: string

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot
    }

    /**
     * Initialize the manager and load existing skills.
     */
    async initialize(): Promise<void> {
        await this.discoverSkills()
    }

    /**
     * Discover skills from .schooberAi/skills directory.
     */
    async discoverSkills(): Promise<void> {
        this.skills.clear()
        const skillsDir = path.join(this.workspaceRoot, ".schooberAi", "skills")

        try {
            // Check if directory exists
            await fs.access(skillsDir)
        } catch {
            // Directory doesn't exist, just return empty
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
     * Load skill metadata from a specific skill directory.
     */
    private async loadSkillMetadata(skillDir: string): Promise<void> {
        const skillMdPath = path.join(skillDir, "SKILL.md")

        try {
            // Check if SKILL.md exists
            await fs.access(skillMdPath)

            const fileContent = await fs.readFile(skillMdPath, "utf-8")
            // Parse frontmatter
            const { data: frontmatter } = matter(fileContent)

            // Basic validation
            if (!frontmatter.name || typeof frontmatter.name !== "string") {
                console.warn(`Skill at ${skillDir} is missing required 'name' field`)
                return
            }
            if (!frontmatter.description || typeof frontmatter.description !== "string") {
                console.warn(`Skill at ${skillDir} is missing required 'description' field`)
                return
            }

            // Store metadata
            this.skills.set(frontmatter.name, {
                name: frontmatter.name,
                description: frontmatter.description,
                path: skillMdPath,
            })
        } catch (error) {
            // SKILL.md missing or not readable
        }
    }

    /**
     * Get all loaded skills.
     */
    getAllSkills(): SkillMetadata[] {
        return Array.from(this.skills.values())
    }

    /**
     * Get full content (instructions) for a specific skill.
     */
    async getSkillContent(name: string): Promise<SkillContent | null> {
        const skill = this.skills.get(name)
        if (!skill) return null

        try {
            const fileContent = await fs.readFile(skill.path, "utf-8")
            const { content } = matter(fileContent)

            return {
                ...skill,
                instructions: content.trim(), // The body of the markdown file
            }
        } catch (error) {
            console.error(`Failed to read skill content for ${name}:`, error)
            return null
        }
    }
}
