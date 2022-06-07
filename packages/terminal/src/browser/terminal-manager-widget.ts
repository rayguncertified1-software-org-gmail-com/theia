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
import { BaseWidget, codicon, PanelLayout, SplitLayout, SplitPanel, SplitPositionHandler, ViewContainerLayout, ViewContainerPart } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';

@injectable()
export class TerminalManagerWidget extends BaseWidget {
    static ID = 'terminal-manager-widget';
    static LABEL = 'Terminal';

    protected panel: SplitPanel;

    @inject(SplitPositionHandler)
    protected readonly splitPositionHandler: SplitPositionHandler;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = TerminalManagerWidget.ID;
        this.title.closable = false;
        this.title.label = TerminalManagerWidget.LABEL;
        this.title.iconClass = codicon('terminal');

        // const layout = new PanelLayout();
        // this.layout = layout;
        // const layoutOptions: SplitLayout.IOptions = { renderer: SplitPanel.defaultRenderer };
        // this.panel = new SplitPanel({
        //     layout: new SplitLayout(layoutOptions),
        // });
        // this.panel.node.tabIndex = -1;
        // this.configureLayout(layout);
        const layout = new PanelLayout();
        this.layout = layout;
        this.panel = new SplitPanel({
            layout: new ViewContainerLayout({
                renderer: SplitPanel.defaultRenderer,
                orientation: 'horizontal',
                spacing: 2,
                headerSize: ViewContainerPart.HEADER_HEIGHT,
                animationDuration: 200
            }, this.splitPositionHandler)
        });
        this.panel.node.tabIndex = -1;
        this.configureLayout(layout);
    }

    protected configureLayout(layout: PanelLayout): void {
        layout.addWidget(this.panel);
    }

    addWidget(widget: TerminalWidget): void {
        if (this.panel.layout) {
            (this.panel.layout as SplitLayout).addWidget(widget);
        }
    }
}
