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
import { TerminalManagerTreeTypes } from './terminal-manager-tree-model';
import { TerminalCommands } from './terminal-frontend-contribution';

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

    protected terminalPanels: SplitPanel[] = [];
    protected activePage: TerminalManagerTreeTypes.PageNode | undefined;
    // protected terminalLayout: ViewContainerLayout;
    // protected terminalLayout: GridLayout;
    protected pageToPanelMap = new Map<TerminalManagerTreeTypes.PageNode, SplitPanel>();
    override layout: PanelLayout;

    @postConstruct()
    protected async init(): Promise<void> {
        // this.toDispose.push(this.treeWidget.onDidChange(() => this.updateViewPage()));
        this.toDispose.push(this.treeWidget.onTreeSelectionChanged(({ activePage, activeTerminal }) => this.handleSelectionChange(activePage, activeTerminal)));
        this.toDispose.push(this.treeWidget.model.onPageAdded(pageNode => this.createNewTerminalPanel(pageNode)));
        this.toDispose.push(this.treeWidget.model.onTerminalAdded(terminalNode => this.addWidgetToActivePanel(terminalNode)));
        this.title.iconClass = codicon('terminal-tmux');
        this.id = TerminalManagerWidget.ID;
        this.title.closable = false;
        this.title.label = TerminalManagerWidget.LABEL;

        // this.layout = new PanelLayout({});
        this.layout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'horizontal',
            spacing: 2,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);
        // this.terminalLayout = new GridLayout();
        // const firstPanel = this.createNewTerminalPanel();
        // this.terminalLayout = new ViewContainerLayout({
        //     renderer: SplitPanel.defaultRenderer,
        //     orientation: 'horizontal',
        //     spacing: 2,
        //     headerSize: 0,
        //     animationDuration: 200
        // }, this.splitPositionHandler);
        // this.panel = new SplitPanel({
        //     layout: this.terminalLayout,
        // });
        // this.panel.node.tabIndex = -1;
        // mainLayout.addWidget(firstPanel);
        this.addTerminalPage();
        await this.commandService.executeCommand(TerminalCommands.NEW_IN_MANAGER.id);
        this.layout.addWidget(this.treeWidget);
        // return this.initializeDefaultWidgets();
    }

    protected async initializeDefaultWidgets(): Promise<void> {
        // this.layout.addWidget(this.treeWidget);
        // await this.commandService.executeCommand(TerminalCommands.NEW_MANAGER_PAGE_TOOLBAR.id);
        // this.terminalLayout.addWidget(this.treeWidget);
    }

    protected createNewTerminalPanel(pageNode: TerminalManagerTreeTypes.PageNode): SplitPanel {
        const terminalLayout = new ViewContainerLayout({
            renderer: SplitPanel.defaultRenderer,
            orientation: 'horizontal',
            spacing: 2,
            headerSize: 0,
            animationDuration: 200
        }, this.splitPositionHandler);
        const panel = new SplitPanel({
            layout: terminalLayout,
        });
        panel.id = pageNode.id;
        panel.node.tabIndex = -1;
        // this.layout.widgets.forEach(widget => this.layout.removeWidget(widget));
        // this.layout.addWidget(panel);
        // this.layout.addWidget(this.treeWidget);
        this.pageToPanelMap.set(pageNode, panel);
        this.updateViewPage(pageNode, panel);
        // this.update();
        return panel;
    }

    protected addWidgetToActivePanel(terminalNode: TerminalManagerTreeTypes.TerminalNode): void {
        const activePanel = this.pageToPanelMap.get(this.treeWidget.model.activePage);
        activePanel?.addWidget(terminalNode.widget);
    }

    protected async updateViewPage(activePage: TerminalManagerTreeTypes.PageNode, panel?: SplitPanel): Promise<void> {
        const activePanel = panel ?? this.pageToPanelMap.get(activePage);
        if (activePanel) {
            console.log('SENTINEL LAYOUTS WIDGETS BEFORE', this.layout.widgets);
            this.layout.widgets.forEach(widget => this.layout.removeWidget(widget));
            console.log('SENTINEL WIDGETS AFTER REMOVAL', this.layout.widgets);
            this.layout.addWidget(activePanel);
            // re-adding treewidget will just move it to end
            this.layout.addWidget(this.treeWidget);
            console.log('SENTINEL WIDGETS AFTER ADDING NEW PANEL', this.layout.widgets);
            console.log('SENTINEL ADDING NEW WIDGET TO ACTIVE PANEL', this.layout.widgets);
            console.log('SENTINEL ACTIVE PANEL', activePanel);
            this.update();
        }
        // if (this.activePage) {
        //     const terminalsInView = this.activePage.children.map(child => child.widget);
        //     if (terminalsInView.length) {
        //         this.terminalLayout.widgets.forEach(part => {
        //             const widget = part.title.owner;
        //             if (widget instanceof TerminalWidgetImpl) {
        //                 if (terminalsInView.includes(widget)) {
        //                     widget.show();
        //                 } else {
        //                     widget.hide();
        //                 }
        //             }
        //         });
        //     }
        //     this.update();
        // }
    }

    protected addWidgetToLayout(widget: TerminalWidget): void {
        // const currentlyAddedWidgets = this.treeWi.widgets.map(part => part.title.owner);
        this.treeWidget.model.addWidget(widget);
        // if (!currentlyAddedWidgets.includes(widget)) {
        //     this.terminalLayout.addWidget(widget);
        // }
    }

    protected handleSelectionChange(activePage: TerminalManagerTreeTypes.PageNode, _activeTerminal: TerminalManagerTreeTypes.TerminalNode): void {
        if (activePage !== this.activePage) {
            this.activePage = activePage;
            this.updateViewPage(activePage);
        }
    }

    addTerminalPage(): TerminalManagerTreeTypes.PageNode | undefined {
        return this.treeWidget.model.addPage();
    }

    addWidget(widget: TerminalWidget): void {
        this.treeWidget.model.addWidget(widget);
    }

    deleteTerminal(terminalNode: TerminalManagerTreeTypes.TreeNode): void {
        this.treeWidget.deleteTerminal(terminalNode);
    }

    toggleRenameTerminal(terminalNode: TerminalManagerTreeTypes.TreeNode): void {
        this.treeWidget.toggleRenameTerminal(terminalNode);
    }
}
