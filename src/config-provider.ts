import { ConfigProvider } from 'tabby-core'

export type SftpDateFormat = 'locale'|'dmy'|'iso'

export interface TabbySidebarOptions {
    showSidebar: boolean
    hideNativeTransfersMenu: boolean
    showSftp: boolean
    sftpAutoRefreshSeconds: number
    sftpAutoReturnToProfiles: boolean
    sftpDateFormat: SftpDateFormat
    sftpShowHidden: boolean
    sftpFoldersFirst: boolean
}

export class TabbySidebarConfigProvider extends ConfigProvider {
    defaults = {
        tabbySidebar: {
            showSidebar: true,
            // Tabby's dropdown opens by itself on every transfer. Off by
            // default here because this plugin has no transfer panel of its
            // own to replace it.
            hideNativeTransfersMenu: false,
            showSftp: true,
            sftpAutoRefreshSeconds: 0,
            sftpAutoReturnToProfiles: true,
            sftpDateFormat: 'locale' as SftpDateFormat,
            sftpShowHidden: true,
            sftpFoldersFirst: true,
        },
    }
}
