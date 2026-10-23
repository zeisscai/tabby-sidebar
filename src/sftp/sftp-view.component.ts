import {
    ApplicationRef,
    Component,
    ComponentFactoryResolver,
    ComponentRef,
    ElementRef,
    EventEmitter,
    Injector,
    Input,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
} from '@angular/core'
import { BaseTabComponent, ConfigService, SplitTabComponent, AppService } from 'tabby-core'
import { merge, Subscription, timer } from 'rxjs'

import { SftpBrowserComponent } from './sftp-browser.component'
import STYLES from './sftp-view.component.css'
import TEMPLATE from './sftp-view.component.html'

const SESSION_LOSS_GRACE_MS = 2500

interface SshSessionLike {
    open: boolean
    openSFTP: () => Promise<unknown>
}

interface SshTabLike extends BaseTabComponent {
    sshSession: SshSessionLike|null
    session: unknown
    openSFTP: () => Promise<unknown>
}

function getAllOpenTabs (app: AppService): BaseTabComponent[] {
    return app.tabs.flatMap(tab => tab instanceof SplitTabComponent ? tab.getAllTabs() : [tab])
}

function isLiveSshTab (tab: BaseTabComponent|null): tab is SshTabLike {
    const candidate = tab as SshTabLike|null
    return !!candidate &&
        !!candidate.sshSession?.open &&
        !!candidate.session &&
        typeof candidate.openSFTP === 'function'
}

@Component({
    selector: 'tabby-sftp-view',
    template: TEMPLATE,
    styles: [STYLES],
})
export class SftpViewComponent implements OnInit, OnDestroy {
    @Output() closed = new EventEmitter<void>()

    @Input() set active (value: boolean) {
        if (this.activeState === value) {
            return
        }
        this.activeState = value
        if (value) {
            this.lostSince = null
            this.returning = false
            setTimeout(() => this.sync())
        } else {
            this.detachBound()
        }
    }

    get isActive (): boolean {
        return this.activeState
    }

    waiting = true
    lostSession = false
    hasLiveSessions = false

    @ViewChild('panelHost', { static: true }) panelHost!: ElementRef<HTMLElement>

    private activeState = false
    private viewReady = false
    private subscription: Subscription|null = null
    private panels = new Map<SshTabLike, ComponentRef<SftpBrowserComponent>>()
    private lastPaths = new Map<SshTabLike, string>()
    private boundTab: SshTabLike|null = null
    private boundSession: SshSessionLike|null = null
    private everBound = false
    private lostSince: number|null = null
    private returning = false

    constructor (
        private app: AppService,
        private appRef: ApplicationRef,
        private resolver: ComponentFactoryResolver,
        private injector: Injector,
        private config: ConfigService,
    ) { }

    ngOnInit (): void {
        this.viewReady = true
        this.subscription = merge(
            this.app.activeTabChange$,
            this.app.tabsChanged$,
            this.app.tabClosed$,
            this.app.tabRemoved$,
            timer(0, 1000),
        ).subscribe(() => this.sync())
    }

    ngOnDestroy (): void {
        this.subscription?.unsubscribe()
        for (const ref of this.panels.values()) {
            this.destroyPanel(ref)
        }
        this.panels.clear()
        this.lastPaths.clear()
        this.boundTab = null
        this.boundSession = null
    }

    get waitingTitle (): string {
        if (this.hasLiveSessions) {
            return '未选择 SSH 会话'
        }
        return this.lostSession ? 'SSH 会话已断开' : '没有活动的 SSH 会话'
    }

    get waitingHint (): string {
        if (this.hasLiveSessions) {
            return '切换到 SSH 标签页即可浏览该会话的文件。'
        }
        if (this.lostSession) {
            return 'SSH 会话已关闭，可返回列表重新连接。'
        }
        return '请先在「服务器」列表中双击连接一个 SSH 服务器。'
    }

    private sync (): void {
        if (!this.isActive || !this.viewReady) {
            return
        }

        this.pruneClosedTabs()

        const tab = this.resolveFocusedSshTab()
        if (!tab) {
            this.detachBound()
            this.waiting = true
            this.lostSession = this.everBound
            this.hasLiveSessions = getAllOpenTabs(this.app).some(isLiveSshTab)
            this.maybeAutoReturn()
            return
        }

        this.hasLiveSessions = true
        this.lostSince = null
        this.lostSession = false
        this.waiting = false

        if (tab === this.boundTab && tab.sshSession === this.boundSession) {
            return
        }

        this.detachBound()
        this.boundTab = tab
        this.boundSession = tab.sshSession
        this.everBound = true
        this.attachPanel(tab)
    }

    private resolveFocusedSshTab (): SshTabLike|null {
        let tab: BaseTabComponent|null = this.app.activeTab
        if (tab instanceof SplitTabComponent) {
            tab = tab.getFocusedTab()
        }
        return isLiveSshTab(tab) ? tab : null
    }

    private maybeAutoReturn (): void {
        if (!this.everBound || !this.config.store.tabbySidebar?.sftpAutoReturnToProfiles) {
            this.lostSince = null
            return
        }
        if (!getAllOpenTabs(this.app).some(isLiveSshTab)) {
            this.lostSince ??= Date.now()
            if (!this.returning && Date.now() - this.lostSince >= SESSION_LOSS_GRACE_MS) {
                this.returning = true
                setTimeout(() => this.closed.emit())
            }
        } else {
            this.lostSince = null
        }
    }

    private attachPanel (tab: SshTabLike): void {
        let ref = this.panels.get(tab)
        if (ref && (ref.instance.session !== tab.sshSession || ref.instance.sftpUnavailable)) {
            this.rememberPath(tab, ref)
            this.destroyPanel(ref)
            this.panels.delete(tab)
            ref = undefined
        }

        if (!ref) {
            const factory = this.resolver.resolveComponentFactory(SftpBrowserComponent)
            ref = factory.create(this.injector)
            ref.instance.session = tab.sshSession as any
            const path = this.lastPaths.get(tab)
            if (path) {
                ref.instance.path = path
            }
            ref.instance.pathChange.subscribe(value => this.lastPaths.set(tab, value))
            this.panels.set(tab, ref)
        }

        ref.instance.setPanelActive(this.isActive)
        this.appRef.attachView(ref.hostView)
        this.panelHost.nativeElement.appendChild(this.rootNodeOf(ref))
    }

    private detachBound (): void {
        const tab = this.boundTab
        this.boundTab = null
        this.boundSession = null
        if (!tab) {
            return
        }
        const ref = this.panels.get(tab)
        if (!ref) {
            return
        }
        this.rememberPath(tab, ref)
        ref.instance.setPanelActive(false)
        this.rootNodeOf(ref).remove()
        this.appRef.detachView(ref.hostView)
    }

    private rememberPath (tab: SshTabLike, ref: ComponentRef<SftpBrowserComponent>): void {
        if (ref.instance.path) {
            this.lastPaths.set(tab, ref.instance.path)
        }
    }

    private pruneClosedTabs (): void {
        const open = new Set(getAllOpenTabs(this.app))
        for (const [tab, ref] of [...this.panels]) {
            if (open.has(tab)) {
                continue
            }
            if (this.boundTab === tab) {
                this.boundTab = null
                this.boundSession = null
            }
            this.destroyPanel(ref)
            this.panels.delete(tab)
            this.lastPaths.delete(tab)
        }
    }

    private destroyPanel (ref: ComponentRef<SftpBrowserComponent>): void {
        this.rootNodeOf(ref).remove()
        this.appRef.detachView(ref.hostView)
        ref.destroy()
    }

    private rootNodeOf (ref: ComponentRef<SftpBrowserComponent>): HTMLElement {
        return (ref.hostView as unknown as { rootNodes: HTMLElement[] }).rootNodes[0]
    }
}
