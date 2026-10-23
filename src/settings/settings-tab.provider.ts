import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'

import { TabbySidebarSettingsComponent } from './settings-tab.component'

@Injectable()
export class TabbySidebarSettingsTabProvider extends SettingsTabProvider {
    id = 'tabby-sidebar'
    icon = 'server'
    title = '服务器侧边栏'
    weight = 2

    getComponentType (): any {
        return TabbySidebarSettingsComponent
    }
}
