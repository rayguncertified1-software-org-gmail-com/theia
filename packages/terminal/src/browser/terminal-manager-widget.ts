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

import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { BaseWidget, codicon, SplitLayout, SplitPanel } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';

@injectable()
export class TerminalManagerWidget extends BaseWidget {
    static ID = 'terminal-manager-widget';
    static LABEL = 'Terminal';

    override layout: SplitLayout;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = TerminalManagerWidget.ID;
        this.title.closable = false;
        this.title.label = TerminalManagerWidget.LABEL;
        this.title.iconClass = codicon('terminal');

        const layoutOptions: SplitLayout.IOptions = { renderer: SplitPanel.defaultRenderer };
        this.layout = new SplitLayout(layoutOptions);
    }

    addWidget(widget: TerminalWidget): void {
        this.layout.addWidget(widget);
    }
}
