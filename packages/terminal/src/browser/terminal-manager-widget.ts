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
import { TerminalManagerTreeTypes } from './terminal-manager-tree-model';

@injectable()
export class TerminalManagerWidget extends BaseWidget {
    static ID = 'terminal-manager-widget';
    static LABEL = 'Terminal';

    static createContainer(parent: interfaces.Container): interfaces.Container {
        const child = parent.createChild();
        child.bind(TerminalManagerTreeWidget).toDynamicValue(context => TerminalManagerTreeWidget.createWidget(child));
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

    protected terminalPages: ViewContainerLayout[] = [];
    protected activePage: TerminalManagerTreeTypes.PageNode | undefined;
    protected terminalLayout: ViewContainerLayout;

    @postConstruct()
    protected async init(): Promise<void> {
        this.toDispose.push(this.treeWidget.onDidChange(() => this.updateView()));
        this.toDispose.push(this.treeWidget.onTreeSelectionChanged(({ activePage, activeTerminal }) => this.handleSelectionChange(activePage, activeTerminal)));
        this.title.iconClass = codicon('terminal-tmux');
        this.id = TerminalManagerWidget.ID;
        this.title.closable = false;
        this.title.label = TerminalManagerWidget.LABEL;

        const mainLayout = new PanelLayout({});
        this.layout = mainLayout;
        this.terminalLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'horizontal',
            spacing: 2,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);
        this.panel = new SplitPanel({
            layout: this.terminalLayout,
        });
        this.panel.node.tabIndex = -1;
        mainLayout.addWidget(this.panel);
        return this.initializeDefaultWidgets();
    }

    protected async updateView(): Promise<void> {
        this.activePage = this.activePage ?? this.treeWidget.model.activePage;
        if (this.activePage) {
            // const terminalsInView = this.activePage.children.map(child => child.widget);
            // this.terminalLayout.widgets.forEach(widget => this.terminalLayout.removeWidget(widget));
            // terminalsInView.forEach(terminal => this.terminalLayout.addWidget(terminal));
            // this.terminalLayout.addWidget(this.treeWidget);
            // this.update();
        }
    }

    protected handleSelectionChange(activePage: TerminalManagerTreeTypes.PageNode, _activeTerminal: TerminalManagerTreeTypes.TerminalNode): void {
        this.activePage = activePage;
        this.updateView();
    }

    protected async initializeDefaultWidgets(): Promise<void> {
        if (this.widgets.length === 0) {
            await this.commandService.executeCommand(TerminalCommands.NEW_MANAGER_PAGE_TOOLBAR.id);
        }
        this.terminalLayout.addWidget(this.treeWidget);
    }

    addTerminalPage(): TerminalManagerTreeTypes.PageNode | undefined {
        return this.treeWidget.addPage();
    }

    addWidget(widget: TerminalWidget, page?: TerminalManagerTreeTypes.PageNode): void {
        const pageToAddTo = page ?? this.activePage;
        if (pageToAddTo) {
            this.treeWidget.addWidget(widget, pageToAddTo);
        }
    }

    deleteTerminal(terminalNode: TerminalManagerTreeTypes.TreeNode): void {
        this.treeWidget.deleteTerminal(terminalNode);
    }

    toggleRenameTerminal(terminalNode: TerminalManagerTreeTypes.TreeNode): void {
        this.treeWidget.toggleRenameTerminal(terminalNode);
    }
}
