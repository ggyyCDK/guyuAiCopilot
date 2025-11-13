export function safetyParse(content: string | Record<string, any>): Record<string, any> {
    if (!content) return {}
    let result = {};
    if (typeof content === 'string') {
        try {
            result = JSON.parse(content)
        } catch (error) {
            result = content
        }
    } else {
        result = content
    }
    return result
}