import { Component, ElementRef, HostBinding, HostListener, OnDestroy, OnInit } from '@angular/core'
import { Subscription } from 'rxjs'
import {
    ConfigService,
    HostAppService,
    HostWindowService,
    PartialProfile,
    Platform,
    Profile,
    ProfilesService,
} from 'tabby-core'

import {
    loadSidebarState,
    saveSidebarState,
    SidebarState,
    SIDEBAR_WIDTH_MAX,
    SIDEBAR_WIDTH_MIN,
} from '../models/sidebar-state'
import STYLES from './server-sidebar.component.css'
import TEMPLATE from './server-sidebar.component.html'

interface ServerGroup {
    id: string
    name: string
    profiles: PartialProfile<Profile>[]
}

@Component({
    selector: 'tabby-server-sidebar',
    template: TEMPLATE,
    styles: [STYLES],
})
export class ServerSidebarComponent implements OnInit, OnDestroy {
    state: SidebarState = loadSidebarState()
    filter = ''
    groups: ServerGroup[] = []
    errorMessage = ''

    @HostBinding('class.overlay') get overlay (): boolean { return !this.state.pinned }
    @HostBinding('class.collapsed') get collapsed (): boolean { return this.state.collapsed }
    @HostBinding('class.mac-inset') macInset = false
    @HostBinding('class.below-tabs') belowTabs = false
    @HostBinding('style.width.px') get hostWidth (): number { return this.state.collapsed ? 0 : this.state.width }

    private configSubscription?: Subscription
    private windowElement: HTMLElement | null = null
    private resizing = false
    private resizeStartX = 0
    private resizeStartWidth = 0

    constructor (
        private elementRef: ElementRef<HTMLElement>,
        private config: ConfigService,
        private hostApp: HostAppService,
        private hostWindow: HostWindowService,
        private profiles: ProfilesService,
    ) { }

    async ngOnInit (): Promise<void> {
        this.windowElement = this.elementRef.nativeElement.parentElement
        this.updateDockedClass()
        this.updateLayoutFlags()
        this.configSubscription = this.config.changed$.subscribe(() => {
            this.updateLayoutFlags()
            void this.loadGroups()
        })
        await this.loadGroups()
    }

    ngOnDestroy (): void {
        this.configSubscription?.unsubscribe()
        this.windowElement?.classList.remove('tabby-sidebar-docked')
    }

    get visibleGroups (): ServerGroup[] {
        const query = this.filter.trim().toLowerCase()
        if (!query) {
            return this.groups
        }

        return this.groups
            .map(group => ({
                ...group,
                profiles: group.profiles.filter(profile =>
                    profile.name.toLowerCase().includes(query) ||
                    this.profileHost(profile).toLowerCase().includes(query)
                ),
            }))
            .filter(group => group.profiles.length > 0)
    }

    isGroupExpanded (group: ServerGroup): boolean {
        return !!this.filter.trim() || !this.state.groupCollapsed[group.id]
    }

    toggleGroup (group: ServerGroup): void {
        if (this.filter.trim()) {
            return
        }
        this.state.groupCollapsed[group.id] = !this.state.groupCollapsed[group.id]
        this.persist()
    }

    togglePinned (): void {
        this.state.pinned = !this.state.pinned
        this.persist()
        this.updateDockedClass()
    }

    collapse (): void {
        this.setCollapsed(true)
    }

    expand (event: MouseEvent): void {
        event.stopPropagation()
        this.setCollapsed(false)
        void this.loadGroups()
    }

    async connect (profile: PartialProfile<Profile>): Promise<void> {
        this.errorMessage = ''
        try {
            const tab = await this.profiles.openNewTabForProfile(profile)
            if (!tab) {
                this.errorMessage = `无法打开「${profile.name}」`
                return
            }
            if (!this.state.pinned) {
                this.setCollapsed(true)
            }
        } catch (error) {
            console.error('tabby-sidebar: failed to open profile', error)
            this.errorMessage = `连接「${profile.name}」失败`
        }
    }

    startResize (event: MouseEvent): void {
        if (this.state.collapsed) {
            return
        }
        this.resizing = true
        this.resizeStartX = event.clientX
        this.resizeStartWidth = this.state.width
        event.preventDefault()
    }

    profileHost (profile: PartialProfile<Profile>): string {
        const options = profile.options ?? {}
        if (!options.host) {
            return ''
        }
        const user = options.user ? `${options.user}@` : ''
        const port = options.port && options.port !== 22 ? `:${options.port}` : ''
        return `${user}${options.host}${port}`
    }

    trackGroup (_index: number, group: ServerGroup): string {
        return group.id
    }

    trackProfile (_index: number, profile: PartialProfile<Profile>): string {
        return profile.id ?? profile.name
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick (event: MouseEvent): void {
        if (this.state.pinned || this.state.collapsed) {
            return
        }
        const target = event.target
        if (target instanceof Node && this.elementRef.nativeElement.contains(target)) {
            return
        }
        this.setCollapsed(true)
    }

    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown (event: KeyboardEvent): void {
        if (event.key === 'Escape' && !this.state.pinned && !this.state.collapsed) {
            this.setCollapsed(true)
        }
    }

    @HostListener('document:mousemove', ['$event'])
    onDocumentMouseMove (event: MouseEvent): void {
        if (!this.resizing) {
            return
        }
        const width = this.resizeStartWidth + event.clientX - this.resizeStartX
        this.state.width = Math.round(Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width)))
    }

    @HostListener('document:mouseup')
    onDocumentMouseUp (): void {
        if (!this.resizing) {
            return
        }
        this.resizing = false
        this.persist()
    }

    @HostListener('window:resize')
    onWindowResize (): void {
        this.updateLayoutFlags()
    }

    private setCollapsed (collapsed: boolean): void {
        if (this.state.collapsed === collapsed) {
            return
        }
        this.state.collapsed = collapsed
        this.persist()
        this.updateDockedClass()
    }

    private updateDockedClass (): void {
        this.windowElement?.classList.toggle('tabby-sidebar-docked', this.state.pinned && !this.state.collapsed)
    }

    private async loadGroups (): Promise<void> {
        this.errorMessage = ''
        try {
            const groups = await this.profiles.getProfileGroups({
                includeProfiles: true,
                includeNonUserGroup: true,
            })
            const blacklist = new Set(this.config.store.profileBlacklist ?? [])

            this.groups = groups
                .map(group => ({
                    id: group.id,
                    name: group.name,
                    profiles: (group.profiles ?? []).filter(profile =>
                        profile.type === 'ssh' &&
                        !profile.isTemplate &&
                        !(profile.id && blacklist.has(profile.id))
                    ),
                }))
                .filter(group => group.profiles.length > 0)

            this.groups.sort((a, b) => a.name.localeCompare(b.name))
            this.groups.sort((a, b) => Number(a.id === 'built-in') - Number(b.id === 'built-in'))
            this.groups.sort((a, b) => Number(a.id !== 'ungrouped') - Number(b.id !== 'ungrouped'))
        } catch (error) {
            console.error('tabby-sidebar: failed to load profiles', error)
            this.errorMessage = '加载服务器配置失败'
        }
    }

    private updateLayoutFlags (): void {
        this.macInset = this.hostApp.platform === Platform.macOS &&
            this.config.store.appearance.frame === 'thin' &&
            !this.hostWindow.isFullscreen

        const tabsVisible = !this.hostWindow.isFullscreen || this.config.store.appearance.tabsInFullscreen
        this.belowTabs = this.config.store.appearance.tabsLocation === 'top' && tabsVisible
    }

    private persist (): void {
        saveSidebarState(this.state)
    }
}
