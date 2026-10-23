import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import TabbyCoreModule, { AppService } from 'tabby-core'

import { ServerSidebarComponent } from './layout/server-sidebar.component'
import { SidebarMountService } from './layout/sidebar-mount.service'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        TabbyCoreModule,
    ],
    declarations: [
        ServerSidebarComponent,
    ],
})
export default class TabbySidebarModule {
    constructor (app: AppService, sidebar: SidebarMountService) {
        app.ready$.subscribe(() => sidebar.scheduleInstall())
    }
}
