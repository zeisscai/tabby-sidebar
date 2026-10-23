import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import TabbyCoreModule, { AppService, ConfigProvider } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

import { TabbySidebarConfigProvider } from './config-provider'
import { ServerSidebarComponent } from './layout/server-sidebar.component'
import { SidebarMountService } from './layout/sidebar-mount.service'
import { SftpBrowserComponent } from './sftp/sftp-browser.component'
import { SftpViewComponent } from './sftp/sftp-view.component'
import { TabbySidebarSettingsComponent } from './settings/settings-tab.component'
import { TabbySidebarSettingsTabProvider } from './settings/settings-tab.provider'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: ConfigProvider, useClass: TabbySidebarConfigProvider, multi: true },
        { provide: SettingsTabProvider, useClass: TabbySidebarSettingsTabProvider, multi: true },
    ],
    declarations: [
        ServerSidebarComponent,
        SftpViewComponent,
        SftpBrowserComponent,
        TabbySidebarSettingsComponent,
    ],
})
export default class TabbySidebarModule {
    constructor (app: AppService, sidebar: SidebarMountService) {
        app.ready$.subscribe(() => sidebar.scheduleInstall())
    }
}
