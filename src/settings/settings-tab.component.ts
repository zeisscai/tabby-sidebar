import { Component, HostBinding } from '@angular/core'
import { ConfigService } from 'tabby-core'

import { SftpDateFormat } from '../config-provider'
import STYLES from './settings-tab.component.css'
import TEMPLATE from './settings-tab.component.html'

@Component({
    selector: 'tabby-sidebar-settings',
    template: TEMPLATE,
    styles: [STYLES],
})
export class TabbySidebarSettingsComponent {
    @HostBinding('class.content-box') contentBox = true

    section: 'general'|'features' = 'general'

    constructor (private config: ConfigService) { }

    setSection (section: 'general'|'features', event: Event): void {
        event.preventDefault()
        this.section = section
    }

    get hideNativeTransfersMenu (): boolean {
        return this.config.store.tabbySidebar?.hideNativeTransfersMenu ?? false
    }

    async setHideNativeTransfersMenu (value: boolean): Promise<void> {
        this.config.store.tabbySidebar.hideNativeTransfersMenu = value
        await this.config.save()
    }

    get showSftp (): boolean {
        return this.config.store.tabbySidebar?.showSftp ?? true
    }

    async setShowSftp (value: boolean): Promise<void> {
        this.config.store.tabbySidebar.showSftp = value
        await this.config.save()
    }

    get autoRefreshSeconds (): number {
        return Number(this.config.store.tabbySidebar?.sftpAutoRefreshSeconds ?? 0)
    }

    async setAutoRefreshSeconds (value: number): Promise<void> {
        const seconds = Math.max(0, Math.min(3600, Math.floor(Number(value) || 0)))
        this.config.store.tabbySidebar.sftpAutoRefreshSeconds = seconds
        await this.config.save()
    }

    get showHidden (): boolean {
        return this.config.store.tabbySidebar?.sftpShowHidden ?? true
    }

    async setShowHidden (value: boolean): Promise<void> {
        this.config.store.tabbySidebar.sftpShowHidden = value
        await this.config.save()
    }

    get foldersFirst (): boolean {
        return this.config.store.tabbySidebar?.sftpFoldersFirst ?? true
    }

    async setFoldersFirst (value: boolean): Promise<void> {
        this.config.store.tabbySidebar.sftpFoldersFirst = value
        await this.config.save()
    }

    get autoReturnToProfiles (): boolean {
        return this.config.store.tabbySidebar?.sftpAutoReturnToProfiles ?? true
    }

    async setAutoReturnToProfiles (value: boolean): Promise<void> {
        this.config.store.tabbySidebar.sftpAutoReturnToProfiles = value
        await this.config.save()
    }

    get dateFormat (): SftpDateFormat {
        const value = this.config.store.tabbySidebar?.sftpDateFormat
        return value === 'dmy' || value === 'iso' ? value : 'locale'
    }

    async setDateFormat (value: string): Promise<void> {
        this.config.store.tabbySidebar.sftpDateFormat = value === 'dmy' || value === 'iso' ? value : 'locale'
        await this.config.save()
    }
}
