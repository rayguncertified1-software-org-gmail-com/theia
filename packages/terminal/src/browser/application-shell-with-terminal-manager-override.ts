// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ApplicationShell, Widget, WidgetManager } from '@theia/core/lib/browser';
import { ApplicationShellWithToolbarOverride } from '@theia/toolbar/lib/browser/application-shell-with-toolbar-override';
import { TerminalManagerWidget } from './terminal-manager-widget';

@injectable()
export class ApplicationShellWithTerminalManagerOverride extends ApplicationShellWithToolbarOverride {
    @inject(WidgetManager) protected readonly widgetManager: WidgetManager;
    terminalManager: TerminalManagerWidget;

    @postConstruct()
    protected override async init(): Promise<void> {
        await super.init();
    }

    protected override initializeShell(): void {
        super.initializeShell();
        // this.createTerminalManager().then(widget => {
        //     this.terminalManager = widget;
        // });
    }

    protected async createTerminalManager(): Promise<TerminalManagerWidget> {
        return this.widgetManager.getOrCreateWidget(TerminalManagerWidget.ID);
    }

    override async addWidget(widget: Widget, options: Readonly<ApplicationShell.WidgetOptions> = {}): Promise<void> {
        super.addWidget(widget, options).catch(e => {
            console.log('SENTINEL GOT ERROR', e);
        });
    }

    // async openInManager(widget: TerminalWidget, options?: TerminalManager.ExtendedWidgetOpenerOptions): Promise<void> {
    //     // const mergedOptions: WidgetOpenerOptions = {
    //     //     mode: 'activate',
    //     //     ...options,
    //     //     widgetOptions: {
    //     //         area: 'bottom',
    //     //         ...(options && options.widgetOptions)
    //     //     }
    //     // };
    //     const terminalManagerWidget = this.tryGetWidget();
    //     if (terminalManagerWidget && !widget.isAttached) {
    //         this.shell.revealWidget(TerminalManagerWidget.ID);
    //         const area = options?.widgetOptions?.area;
    //         if (area) {
    //             if (area === 'terminal-manager-current') {
    //                 terminalManagerWidget.addWidget(widget);
    //             } else if (area === 'terminal-manager-new-page') {
    //                 terminalManagerWidget.addTerminalPage();
    //                 terminalManagerWidget.addWidget(widget);
    //             } else if (TerminalManager.isTerminalID(area)) {
    //                 terminalManagerWidget.splitWidget(widget, area);
    //             }
    //         }
    //         // this.shell.activateWidget(widget.id);
    //     }
    // }

    // async addWidget(widget: Widget, options: Readonly<ApplicationShell.WidgetOptions> = {}): Promise<void> {
    //     if (!widget.id) {
    //         console.error('Widgets added to the application shell must have a unique id property.');
    //         return;
    //     }
    //     let ref: Widget | undefined = options.ref;
    //     let area: ApplicationShell.Area = options.area || 'main';
    //     if (!ref && (area === 'main' || area === 'bottom')) {
    //         const tabBar = this.getTabBarFor(area);
    //         ref = tabBar && tabBar.currentTitle && tabBar.currentTitle.owner || undefined;
    //     }
    //     // make sure that ref belongs to area
    //     area = ref && this.getAreaFor(ref) || area;
    //     const addOptions: DockPanel.IAddOptions = {};
    //     if (ApplicationShell.isOpenToSideMode(options.mode)) {
    //         const areaPanel = area === 'main' ? this.mainPanel : area === 'bottom' ? this.bottomPanel : undefined;
    //         const sideRef = areaPanel && ref && (options.mode === 'open-to-left' ?
    //             areaPanel.previousTabBarWidget(ref) :
    //             areaPanel.nextTabBarWidget(ref));
    //         if (sideRef) {
    //             addOptions.ref = sideRef;
    //         } else {
    //             addOptions.ref = ref;
    //             addOptions.mode = options.mode === 'open-to-left' ? 'split-left' : 'split-right';
    //         }
    //     } else {
    //         addOptions.ref = ref;
    //         addOptions.mode = options.mode;
    //     }
    //     const sidePanelOptions: SidePanel.WidgetOptions = { rank: options.rank };
    //     switch (area) {
    //         case 'main':
    //             this.mainPanel.addWidget(widget, addOptions);
    //             break;
    //         case 'top':
    //             this.topPanel.addWidget(widget);
    //             break;
    //         case 'bottom':
    //             this.bottomPanel.addWidget(widget, addOptions);
    //             break;
    //         case 'left':
    //             this.leftPanelHandler.addWidget(widget, sidePanelOptions);
    //             break;
    //         case 'right':
    //             this.rightPanelHandler.addWidget(widget, sidePanelOptions);
    //             break;
    //         default:
    //             throw new Error('Unexpected area: ' + options.area);
    //     }
    //     if (area !== 'top') {
    //         this.track(widget);
    //     }
    // }
}
