import { McpHubSimple } from "./mcpHub"

/**
 * 使用单例模式，在 Extension 激活时初始化一次，全局都可以使用实例
 */
export class McpServerManager {
	private static instance: McpHubSimple | null = null
	private static initializationPromise: Promise<McpHubSimple> | null = null

	static async getInstance(): Promise<McpHubSimple> {
		if (this.instance) {
			return this.instance
		}
		if (this.initializationPromise) {
			return this.initializationPromise
		}

		this.initializationPromise = (async () => {
			try {
				if (!this.instance) {
					const instance = new McpHubSimple()
					await instance.ready
					this.instance = instance
					console.log('this.instance is', this.instance)
				}
				return this.instance
			} finally {
				this.initializationPromise = null
			}
		})()

		return this.initializationPromise

	}


	static async cleanup(): Promise<void> {
		if (this.instance) {
			await this.instance.dispose();
			this.instance = null
		}
	}
}
