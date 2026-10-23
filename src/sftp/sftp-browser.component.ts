import { Component, Inject, OnDestroy, OnInit, Optional } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ConfigService, LocaleService, NotificationsService, PlatformService } from 'tabby-core'
import { SFTPContextMenuItemProvider, SFTPFile, SFTPPanelComponent } from 'tabby-ssh'
import { Subscription } from 'rxjs'

import STYLES from './sftp-browser.component.css'
import TEMPLATE from './sftp-browser.component.html'

function pad (value: number, width = 2): string {
    return String(value).padStart(width, '0')
}

@Component({
    selector: 'tabby-sftp-browser',
    template: TEMPLATE,
    styles: [STYLES],
})
export class SftpBrowserComponent extends SFTPPanelComponent implements OnInit, OnDestroy {
    errorMessage = ''
    sftpUnavailable = false
    selectedPath: string|null = null
    showFilter = false
    filterText = ''

    private panelActive = true
    private refreshTimer: ReturnType<typeof setInterval>|null = null
    private configSubscription: Subscription|null = null
    private displaySignature = ''

    constructor (
        private config: ConfigService,
        private locale: LocaleService,
        private notify: NotificationsService,
        ngbModalService: NgbModal,
        platform: PlatformService,
        @Optional() @Inject(SFTPContextMenuItemProvider) contextMenuProviders: SFTPContextMenuItemProvider[],
    ) {
        super(ngbModalService, notify, platform, contextMenuProviders ?? [])
    }

    async ngOnInit (): Promise<void> {
        this.displaySignature = this.currentDisplaySignature()
        this.configSubscription = this.config.changed$.subscribe(() => {
            const signature = this.currentDisplaySignature()
            if (signature !== this.displaySignature) {
                this.displaySignature = signature
                void this.navigate(this.path, false)
            }
            this.startAutoRefresh()
        })
        await this.openSftp()
        this.startAutoRefresh()
    }

    ngOnDestroy (): void {
        this.stopAutoRefresh()
        this.configSubscription?.unsubscribe()
    }

    async navigate (newPath: string, fallbackOnError = true): Promise<void> {
        await super.navigate(newPath, fallbackOnError)
        this.applyDisplayOptions()
    }

    async openItem (item: SFTPFile): Promise<void> {
        this.selectedPath = item.fullPath
        try {
            await this.open(item)
        } catch (error) {
            this.notify.error(String((error as Error)?.message ?? error))
        }
    }

    refresh (): void {
        if (this.sftp) {
            void this.navigate(this.path, false)
        }
    }

    async createDirectory (): Promise<void> {
        try {
            await this.openCreateDirectoryModal()
        } catch (error) {
            this.notify.error(String((error as Error)?.message ?? error))
        }
    }

    async uploadFiles (): Promise<void> {
        try {
            await this.upload()
        } catch (error) {
            this.notify.error(String((error as Error)?.message ?? error))
        }
    }

    async uploadDirectory (): Promise<void> {
        try {
            await this.uploadFolder()
        } catch (error) {
            this.notify.error(String((error as Error)?.message ?? error))
        }
    }

    toggleFilter (): void {
        if (this.showFilter) {
            this.clearFilter()
        } else {
            this.showFilter = true
        }
    }

    clearFilter (): void {
        this.showFilter = false
        this.filterText = ''
    }

    get visibleFileList (): SFTPFile[] {
        if (!this.fileList) {
            return []
        }
        const query = this.filterText.trim().toLowerCase()
        if (!query) {
            return this.fileList
        }
        return this.fileList.filter(item => item.name.toLowerCase().includes(query))
    }

    select (item: SFTPFile): void {
        this.selectedPath = item.fullPath
    }

    trackItem (_index: number, item: SFTPFile): string {
        return item.fullPath
    }

    get showHidden (): boolean {
        return this.config.store.tabbySidebar?.sftpShowHidden ?? true
    }

    get foldersFirst (): boolean {
        return this.config.store.tabbySidebar?.sftpFoldersFirst ?? true
    }

    formatSize (size: number): string {
        if (!Number.isFinite(size) || size < 0) {
            return ''
        }
        if (size < 1024) {
            return `${size} B`
        }
        const units = ['KB', 'MB', 'GB', 'TB', 'PB']
        let value = size / 1024
        let unit = 0
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024
            unit++
        }
        return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
    }

    formatDate (value: Date): string {
        const date = value instanceof Date ? value : new Date(value as unknown as string)
        if (isNaN(date.getTime())) {
            return ''
        }
        const format = this.config.store.tabbySidebar?.sftpDateFormat ?? 'locale'
        if (format === 'locale') {
            return date.toLocaleDateString(this.locale.getLocale())
        }
        const day = pad(date.getDate())
        const month = pad(date.getMonth() + 1)
        const year = pad(date.getFullYear(), 4)
        return format === 'iso' ? `${year}-${month}-${day}` : `${day}/${month}/${year}`
    }

    modeString (item: SFTPFile): string {
        try {
            return this.getModeString(item)
        } catch {
            return ''
        }
    }

    setPanelActive (active: boolean): void {
        this.panelActive = active
        this.startAutoRefresh()
    }

    private async openSftp (): Promise<void> {
        this.errorMessage = ''
        this.sftpUnavailable = false
        if (!this.session) {
            this.sftpUnavailable = true
            this.errorMessage = 'SSH 会话不可用'
            return
        }
        try {
            this.sftp = await this.session.openSFTP()
            await this.navigate(this.path)
        } catch (error) {
            this.sftpUnavailable = true
            this.errorMessage = String((error as Error)?.message ?? error ?? '无法打开 SFTP 会话')
            console.error('tabby-sidebar: failed to open SFTP session', error)
        }
    }

    async retry (): Promise<void> {
        await this.openSftp()
        this.startAutoRefresh()
    }

    private applyDisplayOptions (): void {
        if (!this.fileList) {
            return
        }
        let items = this.fileList
        if (!this.showHidden) {
            items = items.filter(item => !item.name.startsWith('.'))
        }
        if (!this.foldersFirst) {
            items = [...items].sort((a, b) => a.name.localeCompare(b.name))
        }
        this.fileList = items
    }

    private currentDisplaySignature (): string {
        return `${this.showHidden ? 1 : 0}:${this.foldersFirst ? 1 : 0}`
    }

    private startAutoRefresh (): void {
        this.stopAutoRefresh()
        const seconds = Number(this.config.store.tabbySidebar?.sftpAutoRefreshSeconds ?? 0)
        if (!this.panelActive || !this.sftp || !Number.isFinite(seconds) || seconds <= 0) {
            return
        }
        this.refreshTimer = setInterval(() => {
            if (this.sftp && this.fileList !== null) {
                void this.navigate(this.path, false)
            }
        }, Math.min(seconds, 3600) * 1000)
    }

    private stopAutoRefresh (): void {
        if (this.refreshTimer !== null) {
            clearInterval(this.refreshTimer)
            this.refreshTimer = null
        }
    }
}
