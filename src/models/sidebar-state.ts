export interface SidebarState {
    width: number
    groupCollapsed: Record<string, boolean>
}

export const SIDEBAR_STATE_KEY = 'tabby-server-sidebar:state'
export const SIDEBAR_WIDTH_MIN = 220
export const SIDEBAR_WIDTH_MAX = 480
export const SIDEBAR_WIDTH_DEFAULT = 288

function defaultState (): SidebarState {
    return {
        width: SIDEBAR_WIDTH_DEFAULT,
        groupCollapsed: {},
    }
}

export function loadSidebarState (): SidebarState {
    const state = defaultState()

    try {
        const raw = window.localStorage.getItem(SIDEBAR_STATE_KEY)
        if (!raw) {
            return state
        }

        const parsed = JSON.parse(raw)
        if (typeof parsed?.width === 'number' && Number.isFinite(parsed.width)) {
            state.width = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, parsed.width))
        }
        if (parsed?.groupCollapsed && typeof parsed.groupCollapsed === 'object') {
            for (const [id, collapsed] of Object.entries(parsed.groupCollapsed)) {
                if (typeof collapsed === 'boolean') {
                    state.groupCollapsed[id] = collapsed
                }
            }
        }
    } catch {
        return defaultState()
    }

    return state
}

export function saveSidebarState (state: SidebarState): void {
    try {
        window.localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(state))
    } catch {
        // Storage can be unavailable or full; the sidebar still works without persistence.
    }
}
