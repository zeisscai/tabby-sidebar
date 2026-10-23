import { ApplicationRef, ComponentFactoryResolver, ComponentRef, Injectable, Injector } from '@angular/core'

import { ServerSidebarComponent } from './server-sidebar.component'

const CONTENT_SELECTOR = 'app-root .window > .content.main'
const RETRY_DELAY = 50
const MAX_ATTEMPTS = 40
const GLOBAL_STYLE_ID = 'tabby-server-sidebar-global-style'
const GLOBAL_STYLE = `
    .window.tabby-sidebar-docked > .content.main > .tab-bar > .inset.background {
        display: none !important;
    }

    body.tabby-sidebar-hide-transfers .btn-group.background > div[ngbDropdown] {
        display: none !important;
    }

    body.tabby-sidebar-hide-transfers transfers-menu {
        display: none !important;
    }
`

@Injectable({ providedIn: 'root' })
export class SidebarMountService {
    private componentRef: ComponentRef<ServerSidebarComponent>|null = null

    constructor (
        private appRef: ApplicationRef,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
    ) { }

    scheduleInstall (): void {
        setTimeout(() => this.install(0))
    }

    private install (attempt: number): void {
        if (this.componentRef) {
            return
        }

        const content = document.querySelector<HTMLElement>(CONTENT_SELECTOR)
        if (!content) {
            if (attempt < MAX_ATTEMPTS) {
                setTimeout(() => this.install(attempt + 1), RETRY_DELAY)
            } else {
                console.error('tabby-sidebar: could not locate the Tabby window layout')
            }
            return
        }

        const windowElement = content.parentElement
        if (!windowElement) {
            console.error('tabby-sidebar: could not locate the Tabby window element')
            return
        }
        windowElement.style.position = 'relative'

        if (!document.getElementById(GLOBAL_STYLE_ID)) {
            const styleElement = document.createElement('style')
            styleElement.id = GLOBAL_STYLE_ID
            styleElement.textContent = GLOBAL_STYLE
            document.head.appendChild(styleElement)
        }

        const hostElement = document.createElement('tabby-server-sidebar')
        content.before(hostElement)

        const factory = this.componentFactoryResolver.resolveComponentFactory(ServerSidebarComponent)
        this.componentRef = factory.create(this.injector, [], hostElement)
        this.appRef.attachView(this.componentRef.hostView)
        this.componentRef.changeDetectorRef.detectChanges()
    }
}
