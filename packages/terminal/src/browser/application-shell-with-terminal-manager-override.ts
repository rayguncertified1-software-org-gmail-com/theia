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
import { FrontendApplicationStateService } from '@theia/core/lib/browser/frontend-application-state';
import { TerminalManager } from './terminal-manager-types';
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
            this.terminalManager.initializePanelSizes();
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
                    terminalManagerWidget.addTerminalGroup(widget);
                } else if (area === 'terminal-manager-new-page') {
                    terminalManagerWidget.addTerminalPage(widget);
                    // terminalManagerWidget.addNewWidgetColumn(widget);
                } else if (TerminalManager.isTerminalID(area)) {
                    terminalManagerWidget.splitWidget(widget, area);
                } else {
                    throw new Error('Unexpected area: ' + options.area);
                }
                this.track(widget);
            }
        }
    }
}
