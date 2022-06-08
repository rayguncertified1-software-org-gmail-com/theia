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

import { inject, injectable, interfaces, postConstruct } from '@theia/core/shared/inversify';
import { BaseWidget, codicon, PanelLayout, SplitLayout, SplitPanel, SplitPositionHandler, ViewContainerLayout } from '@theia/core/lib/browser';
import { TerminalWidget } from './base/terminal-widget';
import { TerminalManagerTreeWidget } from './terminal-manager-tree-widget';
import { TerminalWidgetImpl } from './terminal-widget-impl';
import { CommandService } from '@theia/core';
import { TerminalCommands } from './terminal-frontend-contribution';

@injectable()
export class TerminalManagerWidget extends BaseWidget {
    static ID = 'terminal-manager-widget';
    static LABEL = 'Terminal';

    static createContainer(parent: interfaces.Container): interfaces.Container {
        const child = parent.createChild();
        child.bind(TerminalManagerTreeWidget).toDynamicValue(context => TerminalManagerTreeWidget.createWidget(context.container));
        child.bind(TerminalManagerWidget).toSelf().inSingletonScope();
        return child;
    }

    static createWidget(parent: interfaces.Container): TerminalManagerWidget {
        return TerminalManagerWidget.createContainer(parent).get(TerminalManagerWidget);
    }

    protected panel: SplitPanel;
    _widgets: TerminalWidgetImpl[] = [];

    get widgets(): TerminalWidgetImpl[] {
        return (this.panel.layout as SplitLayout)?.widgets
            .filter((widget): widget is TerminalWidgetImpl => widget instanceof TerminalWidgetImpl);
    }

    @inject(SplitPositionHandler)
    protected readonly splitPositionHandler: SplitPositionHandler;

    @inject(TerminalManagerTreeWidget) protected readonly treeWidget: TerminalManagerTreeWidget;

    @inject(CommandService) protected readonly commandService: CommandService;

    protected panelLayout: ViewContainerLayout | undefined;

    @postConstruct()
    protected async init(): Promise<void> {
        this.id = TerminalManagerWidget.ID;
        this.title.closable = false;
        this.title.label = TerminalManagerWidget.LABEL;
        this.title.iconClass = codicon('terminal');

        const layout = new PanelLayout();
        this.layout = layout;
        this.panelLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'horizontal',
            spacing: 2,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);

        this.panel = new SplitPanel({
            layout: this.panelLayout,
        });
        this.panel.node.tabIndex = -1;
        layout.addWidget(this.panel);
        await this.initializeDefaultWidgets();
    }

    protected async initializeDefaultWidgets(): Promise<void> {
        if (this.widgets.length === 0) {
            await this.commandService.executeCommand(TerminalCommands.NEW_ACTIVE_WORKSPACE.id);
        }
        this.panelLayout?.addWidget(this.treeWidget);
    }

    addWidget(widget: TerminalWidget): void {
        const numWidgets = this.panelLayout?.widgets.length;
        const index = numWidgets ? numWidgets - 2 : 0;
        this.panelLayout?.insertWidget(index, widget);
        this.treeWidget.addWidget(widget);
    }
}
