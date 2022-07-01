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
import { ApplicationShell, DockLayout, SidePanel, Widget, WidgetManager } from '@theia/core/lib/browser';
import { ApplicationShellWithToolbarOverride } from '@theia/toolbar/lib/browser/application-shell-with-toolbar-override';
import { TerminalManagerWidget } from './terminal-manager-widget';
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { TerminalManager, TerminalManagerTreeTypes } from './terminal-manager-types';
import { Deferred } from '@theia/core/lib/common/promise-util';

@injectable()
export class ApplicationShellWithTerminalManagerOverride extends ApplicationShellWithToolbarOverride {
    @inject(WidgetManager) protected readonly widgetManager: WidgetManager;
    terminalManager: TerminalManagerWidget;
    @inject(FrontendApplicationStateService) protected readonly frontendState: FrontendApplicationStateService;

    protected terminalManagerIsReadyDeferred = new Deferred();
    readonly terminalManagerIsReady = this.terminalManagerIsReadyDeferred.promise;

    @postConstruct()
    protected override async init(): Promise<void> {
        await super.init();
    }

    protected override initializeShell(): void {
        super.initializeShell();
        this.frontendState.reachedState('ready').then(() => this.createTerminalManager()).then(widget => {
            this.terminalManager = widget;
            this.bottomPanel.addWidget(this.terminalManager);
            this.terminalManagerIsReadyDeferred.resolve();
        });
    }

    protected async createTerminalManager(): Promise<TerminalManagerWidget> {
        return this.widgetManager.getOrCreateWidget(TerminalManagerWidget.ID);
    }

    override async addWidget(widget: Widget, options: Readonly<ApplicationShell.WidgetOptions> = {}): Promise<void> {
        super.addWidget(widget, options).catch(() => {
            this.openInManager(widget, options);
        });
    }

    async openInManager(widget: Widget, options?: TerminalManager.ExtendedWidgetOptions): Promise<void> {
        await this.terminalManagerIsReady;
        const terminalManagerWidget = this.terminalManager;
        if (terminalManagerWidget && !widget.isAttached) {
            this.revealWidget(TerminalManagerWidget.ID);
            const area = options?.area;
            if (area) {
                if (area === 'terminal-manager-current') {
                    terminalManagerWidget.addTerminalGroupToPage(widget);
                } else if (area === 'terminal-manager-new-page') {
                    terminalManagerWidget.addTerminalPage(widget);
                    // terminalManagerWidget.addNewWidgetColumn(widget);
                } else if (TerminalManagerTreeTypes.isTerminalID(area)) {
                    terminalManagerWidget.addWidgetToTerminalGroup(widget, area);
                } else {
                    throw new Error('Unexpected area: ' + options.area);
                }
                this.track(widget);
            }
        }
    }

    override getLayoutData(): TerminalManager.ApplicationShellLayoutData {
        return {
            ...super.getLayoutData(),
            terminalManager: this.terminalManager.getLayoutData(),
        };
    }

    override async setLayoutData(layoutData: TerminalManager.ApplicationShellLayoutData): Promise<void> {
        await super.setLayoutData(layoutData);
        const { terminalManager, activeWidgetId } = layoutData;
        if (terminalManager) {
            this.terminalManagerIsReady.then(() => {
                this.terminalManager.setLayoutData(terminalManager);
                this.registerWithFocusTracker(terminalManager);
                if (activeWidgetId) {
                    this.activateWidget(activeWidgetId);
                }
            });
        }
    }

    protected override registerWithFocusTracker(
        data: DockLayout.ITabAreaConfig | DockLayout.ISplitAreaConfig | SidePanel.LayoutData | TerminalManager.LayoutData | null
    ): void {
        if (data && TerminalManager.isLayoutData(data)) {
            // TODO
            // if (data.items) {
            //     // for (const widget of data.items) {

            //     // }
            // }
            return;
        }
        super.registerWithFocusTracker(data);
    }
}
